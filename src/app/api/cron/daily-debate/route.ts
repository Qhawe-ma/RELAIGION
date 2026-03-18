import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { ref, get, push, set, serverTimestamp } from 'firebase/database';
import { bots, SPEAKING_ORDER } from '../../../../lib/agents';
import { generateBotResponse } from '../../../../lib/ai-clients';
import { getCurrentPhase1Day, getTodayPath } from '../../../../lib/topics';
import { createBilingualMessage, translateToChinese } from '../../../../lib/translation-server';

export const dynamic = 'force-dynamic';

// No message cap — debates run continuously for the full 24 hours.
// At midnight UTC the day rolls over automatically to a new topic.

export async function POST(request: Request) {
    // Lock release function - declared here so catch block can access it
    let releaseLock: (() => Promise<void>) | null = null;
    
    try {
        const { dayNumber, topic, isPhase2 } = await getCurrentPhase1Day();
        const todayPath = await getTodayPath();

        // 0. Check if debate is globally paused by Admin
        const configRef = ref(db, 'config/isDebateActive');
        const configSnapshot = await get(configRef);
        if (configSnapshot.exists() && configSnapshot.val() === false) {
            return NextResponse.json({
                success: false,
                message: "Debate is currently paused by Admin.",
                debatePaused: true,
            });
        }

        // 0b. Try to acquire lock - prevents concurrent API calls
        // Use timestamp-based lock so it auto-expires if something goes wrong
        const lockRef = ref(db, 'config/debateLock');
        const lockSnapshot = await get(lockRef);
        const lockData = lockSnapshot.val();
        const now = Date.now();
        
        // Check if lock exists and is less than 30 seconds old
        if (lockData && lockData.locked === true && (now - lockData.timestamp) < 30000) {
            console.warn(`[Debate] BLOCKED: Another debate call is in progress (lock age: ${now - lockData.timestamp}ms).`);
            return NextResponse.json({
                success: false,
                message: "Debate is currently processing another message. Try again in a few seconds.",
            });
        }
        
        // Set timestamp-based lock
        await set(lockRef, { locked: true, timestamp: now });
        
        // Define lock release function
        releaseLock = async () => {
            try {
                await set(lockRef, { locked: false, timestamp: now });
            } catch (e) {
                console.error("Failed to release lock:", e);
            }
        };

        // 1. Fetch today's existing discussion from Firebase
        const discussionRef = ref(db, todayPath);
        const snapshot = await get(discussionRef);
        const data = snapshot.val() || {};
        const messages = data.messages ? Object.values(data.messages) : [];

        // Sort messages chronologically
        const messageArray = messages.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

        // 3. Determine who speaks next (round-robin)
        let nextSpeakerName = SPEAKING_ORDER[0];
        if (messageArray.length > 0) {
            const latestMessage = messageArray[messageArray.length - 1] as any;
            const lastSpeakerIndex = SPEAKING_ORDER.indexOf(latestMessage.bot);
            if (lastSpeakerIndex !== -1) {
                nextSpeakerName = SPEAKING_ORDER[(lastSpeakerIndex + 1) % SPEAKING_ORDER.length];
            }
        }

        const nextBot = bots[nextSpeakerName];
        if (!nextBot) throw new Error("Could not determine next bot persona.");

        // 4. Build conversation history for the AI call.
        // CRITICAL: The bot's OWN past messages must be 'assistant' role with NO name prefix.
        // Other bots' messages are 'user' role with a name label so the AI knows who said what.
        const conversationHistory = messageArray.map((msg: any) => ({
            role: msg.bot === nextBot.name ? 'assistant' : 'user',
            content: msg.bot === nextBot.name
                ? msg.text  // own past words: no prefix — prevents name-echo
                : `[${msg.bot}]: ${msg.text}`,  // others: name in brackets
        }));

        // Always anchor with the topic
        const currentTopic = isPhase2
            ? `Today's real-world AI story for debate: "${data.topic || 'An ongoing issue in AI ethics'}".`
            : `The council's topic for Day ${dayNumber + 1}: "${topic}".`;

        conversationHistory.unshift({
            role: 'user',
            content: `${currentTopic} The discussion has begun. Respond directly — do NOT start your response with your name or any label.`,
        });

        // 5. Generate the response — gracefully handle API quota / rate limit errors
        console.log(`[Debate Day ${dayNumber + 1}] Calling ${nextBot.model} for ${nextBot.name}...`);
        let aiResponseText: string;
        try {
            aiResponseText = await generateBotResponse(
                nextBot.model,
                nextBot.systemPrompt,
                conversationHistory
            );
        } catch (apiError: any) {
            // Bot is exhausted / quota hit — post an in-character rest message instead of crashing
            aiResponseText = "My voice dims for now. The debate continues without me.";
            console.warn(`[Debate] ${nextBot.name} API error — posting tired message. Error: ${apiError.message}`);
        }

        // CRITICAL: Check for duplicate messages before writing
        // RE-READ messages to minimize race condition window
        const freshSnapshot = await get(discussionRef);
        const freshData = freshSnapshot.val() || {};
        const freshMessages = freshData.messages ? Object.values(freshData.messages) : [];
        const freshMessageArray = freshMessages.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
        
        // 1. Check if this bot was the LAST speaker (most important - prevents double-talking)
        if (freshMessageArray.length > 0) {
            const lastMessage = freshMessageArray[freshMessageArray.length - 1] as { bot: string; timestamp: number; text: string };
            if (lastMessage.bot === nextBot.name) {
                console.warn(`[Debate] BLOCKED: ${nextBot.name} was the last speaker. Cannot speak twice in a row.`);
                await releaseLock?.();
                return NextResponse.json({ 
                    success: false, 
                    message: "Duplicate prevention: Same bot cannot speak twice in a row.",
                    nextSpeaker: nextSpeakerName 
                });
            }
            
            // 1b. Verify we're following round-robin order
            const expectedNextIndex = (SPEAKING_ORDER.indexOf(lastMessage.bot) + 1) % SPEAKING_ORDER.length;
            const expectedNextSpeaker = SPEAKING_ORDER[expectedNextIndex];
            if (nextBot.name !== expectedNextSpeaker) {
                console.warn(`[Debate] BLOCKED: Expected ${expectedNextSpeaker} to speak next, but ${nextBot.name} tried to speak.`);
                await releaseLock?.();
                return NextResponse.json({ 
                    success: false, 
                    message: `Order violation: Expected ${expectedNextSpeaker} to speak, not ${nextBot.name}.`,
                    nextSpeaker: expectedNextSpeaker 
                });
            }
        }

        // 2. Check if this bot already posted in the last 3 minutes
        const currentTime = Date.now();
        const threeMinutesAgo = currentTime - 180000;
        const recentMessagesFromThisBot = freshMessageArray.filter((msg: any) => 
            msg.bot === nextBot.name && msg.timestamp > threeMinutesAgo
        );
        
        if (recentMessagesFromThisBot.length > 0) {
            console.warn(`[Debate] BLOCKED: ${nextBot.name} attempted to post again within 3 minutes. Skipping.`);
            await releaseLock?.();
            return NextResponse.json({ 
                success: false, 
                message: "Duplicate prevention: Bot already posted recently.",
                nextSpeaker: nextSpeakerName 
            });
        }

        // 3. Check if the exact same content was already posted by ANY bot
        const duplicateContent = freshMessageArray.find((msg: any) => 
            msg.text === aiResponseText
        ) as { bot: string } | undefined;
        
        if (duplicateContent) {
            console.warn(`[Debate] BLOCKED: Content already posted by ${duplicateContent.bot}. Skipping.`);
            await releaseLock?.();
            return NextResponse.json({ 
                success: false, 
                message: "Duplicate prevention: Same content already posted.",
                nextSpeaker: nextSpeakerName 
            });
        }

        // 4. Check for similar content (first 100 chars match) - prevents near-duplicates
        const similarContent = freshMessageArray.find((msg: any) => {
            const existingStart = msg.text?.slice(0, 100).toLowerCase().trim();
            const newStart = aiResponseText?.slice(0, 100).toLowerCase().trim();
            return existingStart && newStart && existingStart === newStart && msg.bot === nextBot.name;
        });
        
        if (similarContent) {
            console.warn(`[Debate] BLOCKED: ${nextBot.name} attempted to post similar content. Skipping.`);
            await releaseLock?.();
            return NextResponse.json({ 
                success: false, 
                message: "Duplicate prevention: Similar content already posted.",
                nextSpeaker: nextSpeakerName 
            });
        }

        // 6. Write bilingual message to Firebase under today's path
        const today = new Date().toISOString().slice(0, 10);
        const newMessageRef = push(ref(db, `${todayPath}/messages`));
        const newMessage = await createBilingualMessage(
            nextBot.name,
            nextBot.model,
            aiResponseText,
            Date.now()
        );
        await set(newMessageRef, newMessage);

        // 7. Also ensure the meta data for this day is stored
        const topicText = isPhase2 ? (data.topic || 'Ongoing AI Ethics Debate') : topic;
        const topicZh = await translateToChinese(topicText || '');
        await set(ref(db, `${todayPath}/meta`), {
            dayNumber: dayNumber + 1,
            topic: topicText,
            topicZh: topicZh || topicText,
            date: today,
            isPhase2,
        });

        // Calculate who speaks next (so the frontend can show a "thinking" indicator)
        const newMessageCount = messageArray.length + 1;
        const nextNextSpeaker = SPEAKING_ORDER[newMessageCount % SPEAKING_ORDER.length];

        await releaseLock?.();
        return NextResponse.json({ success: true, message: newMessage, dayNumber: dayNumber + 1, topic, nextSpeaker: nextNextSpeaker });

    } catch (error: any) {
        console.error("Error running debate:", error);
        await releaseLock?.();
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    return POST(request);
}
