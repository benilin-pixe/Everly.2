import { WebSocket } from 'ws';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== STARTING COMPLETE TWO-ACCOUNT REAL-TIME & WEBRTC TEST SUITE ===\n');

  const WS_URL = 'ws://localhost:3000/api/ws';
  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // TEST 1: Backend Security - Reject Unauthorized 3rd-Party User via WebSocket
  console.log('--- 1. Testing Unauthorized Account Rejection ---');
  const wsUnauthorized = new WebSocket(WS_URL);
  let unauthorizedRejected = false;
  wsUnauthorized.on('open', () => {
    wsUnauthorized.send(JSON.stringify({
      type: 'auth:init',
      userEmail: 'stranger@example.com',
      userName: 'Unknown Stranger',
    }));
  });
  wsUnauthorized.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    if (parsed.type === 'auth:error') {
      unauthorizedRejected = true;
    }
  });
  wsUnauthorized.on('close', (code) => {
    if (code === 4003 || unauthorizedRejected) {
      unauthorizedRejected = true;
    }
  });
  await delay(400);
  assert('Backend strictly rejects 3rd-party/unauthorized account WebSocket auth', unauthorizedRejected);

  // TEST 2: REST Security - Reject Unauthorized Requests
  console.log('--- 2. Testing REST Endpoints Security & Two-Account Enforcement ---');
  const resStranger = await fetch('http://localhost:3000/api/comm/users?email=stranger@example.com');
  const dataStranger = await resStranger.json();
  assert('GET /api/comm/users for stranger returns empty list', dataStranger.users && dataStranger.users.length === 0);

  const resBenUsers = await fetch('http://localhost:3000/api/comm/users?email=benilin76@gmail.com');
  const dataBenUsers = await resBenUsers.json();
  assert('When Account 1 queries users, returns EXACTLY 1 contact (Account 2)', dataBenUsers.users.length === 1 && dataBenUsers.users[0].email === 'shanalove917@gmail.com');
  assert('Logged-in Account 1 NEVER appears in its own contact list', !dataBenUsers.users.some((u: any) => u.email === 'benilin76@gmail.com'));

  const resShanaUsers = await fetch('http://localhost:3000/api/comm/users?email=shanalove917@gmail.com');
  const dataShanaUsers = await resShanaUsers.json();
  assert('When Account 2 queries users, returns EXACTLY 1 contact (Account 1)', dataShanaUsers.users.length === 1 && dataShanaUsers.users[0].email === 'benilin76@gmail.com');
  assert('Logged-in Account 2 NEVER appears in its own contact list', !dataShanaUsers.users.some((u: any) => u.email === 'shanalove917@gmail.com'));

  // Test unauthorized message rejection on REST
  const resBadMsg = await fetch('http://localhost:3000/api/comm/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderEmail: 'benilin76@gmail.com',
      recipientEmail: 'random@external.com',
      text: 'Trying to reach third party',
    }),
  });
  assert('Backend strictly rejects message sending to unauthorized recipient (403)', resBadMsg.status === 403);

  // TEST 3: Connecting Authorized Account 1 & Account 2
  console.log('--- 3. Testing Real-time WebSocket Messaging & Presence ---');
  const ws1 = new WebSocket(WS_URL);
  let ws1Ready = false;
  let ws1Messages: any[] = [];
  ws1.on('open', () => {
    ws1Ready = true;
    ws1.send(JSON.stringify({
      type: 'auth:init',
      userEmail: 'benilin76@gmail.com',
      userName: 'Ben Lin',
    }));
  });
  ws1.on('message', (data) => {
    ws1Messages.push(JSON.parse(data.toString()));
  });

  const ws2 = new WebSocket(WS_URL);
  let ws2Ready = false;
  let ws2Messages: any[] = [];
  ws2.on('open', () => {
    ws2Ready = true;
    ws2.send(JSON.stringify({
      type: 'auth:init',
      userEmail: 'shanalove917@gmail.com',
      userName: 'Shana Love',
    }));
  });
  ws2.on('message', (data) => {
    ws2Messages.push(JSON.parse(data.toString()));
  });

  await delay(600);
  assert('Account 1 & Account 2 authenticated successfully on /api/ws', ws1Ready && ws2Ready);

  const auth1 = ws1Messages.find((m) => m.type === 'auth:success');
  const auth2 = ws2Messages.find((m) => m.type === 'auth:success');
  assert('Both accounts received auth:success', Boolean(auth1 && auth2));

  // Presence updates
  const presence1 = ws1Messages.find((m) => m.type === 'presence:update' && m.userEmail === 'shanalove917@gmail.com');
  assert('Account 1 received real-time online presence update for Account 2', Boolean(presence1 && presence1.isOnline));

  // Typing indicator
  ws1.send(JSON.stringify({
    type: 'chat:typing',
    conversationId: 'conv_ben_shana_couple',
    recipientEmail: 'shanalove917@gmail.com',
    isTyping: true,
  }));
  await delay(300);

  const typingEvt = ws2Messages.find((m) => m.type === 'chat:typing' && m.isTyping === true);
  assert('Account 2 received typing indicator from Account 1', Boolean(typingEvt));

  // Send Message
  const testText = 'Hello my love! Test message timestamp: ' + Date.now();
  ws1.send(JSON.stringify({
    type: 'chat:message',
    recipientEmail: 'shanalove917@gmail.com',
    text: testText,
  }));
  await delay(400);

  const sentConfirmation = ws1Messages.find((m) => m.type === 'chat:message:sent' && m.message.text === testText);
  const deliveredEvt = ws1Messages.find((m) => m.type === 'chat:message:status' && m.status === 'delivered');
  const newMsgReceived = ws2Messages.find((m) => m.type === 'chat:message:new' && m.message.text === testText);

  assert('Account 1 received chat:message:sent confirmation', Boolean(sentConfirmation));
  assert('Account 2 received chat:message:new in real time', Boolean(newMsgReceived));
  assert('Account 1 received delivered status update', Boolean(deliveredEvt));

  const createdMsgId = sentConfirmation ? sentConfirmation.message.id : '';

  // Read status
  if (createdMsgId) {
    ws2.send(JSON.stringify({
      type: 'chat:read',
      conversationId: 'conv_ben_shana_couple',
      partnerEmail: 'benilin76@gmail.com',
    }));
    await delay(300);

    const readEvt = ws1Messages.find((m) => m.type === 'chat:message:read');
    assert('Account 1 received read status receipt', Boolean(readEvt));

    // Delete message
    ws1.send(JSON.stringify({
      type: 'chat:delete',
      messageId: createdMsgId,
      conversationId: 'conv_ben_shana_couple',
      recipientEmail: 'shanalove917@gmail.com',
    }));
    await delay(300);

    const delete1 = ws1Messages.find((m) => m.type === 'chat:message:deleted' && m.messageId === createdMsgId);
    const delete2 = ws2Messages.find((m) => m.type === 'chat:message:deleted' && m.messageId === createdMsgId);
    assert('Message deletion synced between both accounts', Boolean(delete1 && delete2));
  }

  // TEST 4: Audio Call Flow
  console.log('--- 4. Testing Audio Call Flow ---');
  const audioCallId = `call_audio_${Date.now()}`;
  ws1.send(JSON.stringify({
    type: 'call:initiate',
    callId: audioCallId,
    receiverEmail: 'shanalove917@gmail.com',
    receiverName: 'Shana Love',
    callType: 'audio',
  }));
  await delay(400);

  const incomingAudio = ws2Messages.find((m) => m.type === 'call:incoming' && m.callId === audioCallId);
  assert('Account 2 received incoming audio call notification', Boolean(incomingAudio && incomingAudio.callType === 'audio'));

  ws2.send(JSON.stringify({
    type: 'call:ringing',
    callId: audioCallId,
    callerEmail: 'benilin76@gmail.com',
  }));
  await delay(200);

  const ringingAudio = ws1Messages.find((m) => m.type === 'call:ringing' && m.callId === audioCallId);
  assert('Account 1 received call:ringing notification for audio call', Boolean(ringingAudio));

  ws2.send(JSON.stringify({
    type: 'call:accept',
    callId: audioCallId,
    callerEmail: 'benilin76@gmail.com',
  }));
  await delay(300);

  const acceptedAudio = ws1Messages.find((m) => m.type === 'call:accepted' && m.callId === audioCallId);
  assert('Account 1 received call:accepted signal for audio call', Boolean(acceptedAudio));

  ws1.send(JSON.stringify({
    type: 'call:end',
    callId: audioCallId,
    peerEmail: 'shanalove917@gmail.com',
    durationSec: 30,
  }));
  await delay(300);

  const endedAudio = ws2Messages.find((m) => m.type === 'call:ended' && m.callId === audioCallId);
  assert('Audio call ended cleanly and duration logged', Boolean(endedAudio));

  // TEST 5: Video Call Flow & WebRTC Signaling
  console.log('--- 5. Testing Video Call & WebRTC Signaling Flow ---');
  const videoCallId = `call_video_${Date.now()}`;
  ws1.send(JSON.stringify({
    type: 'call:initiate',
    callId: videoCallId,
    receiverEmail: 'shanalove917@gmail.com',
    receiverName: 'Shana Love',
    callType: 'video',
  }));
  await delay(400);

  const incomingVideo = ws2Messages.find((m) => m.type === 'call:incoming' && m.callId === videoCallId);
  assert('Account 2 received incoming video call notification', Boolean(incomingVideo && incomingVideo.callType === 'video'));

  ws2.send(JSON.stringify({
    type: 'call:accept',
    callId: videoCallId,
    callerEmail: 'benilin76@gmail.com',
  }));
  await delay(300);

  // WebRTC Offer SDP
  const mockOfferSdp = { type: 'offer', sdp: 'v=0\r\no=alice 123 456 IN IP4 127.0.0.1\r\ns=-\r\n' };
  ws1.send(JSON.stringify({
    type: 'call:signal:offer',
    callId: videoCallId,
    targetEmail: 'shanalove917@gmail.com',
    sdp: mockOfferSdp,
  }));
  await delay(300);

  const offerReceived = ws2Messages.find((m) => m.type === 'call:signal:offer' && m.callId === videoCallId);
  assert('Account 2 received WebRTC Offer SDP signal', Boolean(offerReceived && offerReceived.sdp));

  // WebRTC Answer SDP
  const mockAnswerSdp = { type: 'answer', sdp: 'v=0\r\no=bob 789 101 IN IP4 127.0.0.1\r\ns=-\r\n' };
  ws2.send(JSON.stringify({
    type: 'call:signal:answer',
    callId: videoCallId,
    targetEmail: 'benilin76@gmail.com',
    sdp: mockAnswerSdp,
  }));
  await delay(300);

  const answerReceived = ws1Messages.find((m) => m.type === 'call:signal:answer' && m.callId === videoCallId);
  assert('Account 1 received WebRTC Answer SDP signal', Boolean(answerReceived && answerReceived.sdp));

  // ICE Candidate
  const mockIce = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  ws1.send(JSON.stringify({
    type: 'call:signal:ice',
    callId: videoCallId,
    targetEmail: 'shanalove917@gmail.com',
    candidate: mockIce,
  }));
  await delay(300);

  const iceReceived = ws2Messages.find((m) => m.type === 'call:signal:ice' && m.callId === videoCallId);
  assert('Account 2 received ICE candidate signal', Boolean(iceReceived && iceReceived.candidate));

  // Camera Off / Microphone Mute Toggle Signal
  ws1.send(JSON.stringify({
    type: 'call:signal:toggle_media',
    callId: videoCallId,
    targetEmail: 'shanalove917@gmail.com',
    isVideoMuted: true,
    isAudioMuted: false,
  }));
  await delay(300);

  const toggleReceived = ws2Messages.find((m) => m.type === 'call:signal:toggle_media' && m.isVideoMuted === true);
  assert('Account 2 received camera off / mic mute toggle signal', Boolean(toggleReceived));

  // End Video Call
  ws1.send(JSON.stringify({
    type: 'call:end',
    callId: videoCallId,
    peerEmail: 'shanalove917@gmail.com',
    durationSec: 125,
  }));
  await delay(300);

  const videoEnded = ws2Messages.find((m) => m.type === 'call:ended' && m.callId === videoCallId);
  assert('Video call ended cleanly with duration logged', Boolean(videoEnded && videoEnded.durationSec === 125));

  // TEST 6: Call Rejection / Decline Flow
  console.log('--- 6. Testing Call Rejection / Decline Flow ---');
  const rejectCallId = `call_reject_${Date.now()}`;
  ws1.send(JSON.stringify({
    type: 'call:initiate',
    callId: rejectCallId,
    receiverEmail: 'shanalove917@gmail.com',
    receiverName: 'Shana Love',
    callType: 'audio',
  }));
  await delay(300);

  ws2.send(JSON.stringify({
    type: 'call:reject',
    callId: rejectCallId,
    callerEmail: 'benilin76@gmail.com',
    reason: 'declined',
  }));
  await delay(300);

  const rejectReceived = ws1Messages.find((m) => m.type === 'call:rejected' && m.callId === rejectCallId);
  assert('Account 1 received call:rejected event when Account 2 declines', Boolean(rejectReceived));

  ws1.close();
  ws2.close();
  await delay(300);

  // TEST 7: Vite HMR WebSocket Coexistence
  console.log('--- 7. Testing Vite HMR WebSocket Independence ---');
  const viteWs = new WebSocket('ws://localhost:3000/', 'vite-hmr');
  let viteConnected = false;
  viteWs.on('open', () => {
    viteConnected = true;
    viteWs.close();
  });
  await delay(500);

  assert('Vite HMR WebSocket on root path operates cleanly with Sec-WebSocket-Protocol: vite-hmr', viteConnected);

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
