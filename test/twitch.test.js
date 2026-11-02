import test from 'node:test';
import assert from 'node:assert/strict';
import { Twitch } from '../twitch.js';
test('login requests exact scopes and binds state to browser cookie', () => {
  const oldId=process.env.TWITCH_CLIENT_ID,oldSecret=process.env.TWITCH_CLIENT_SECRET;
  process.env.TWITCH_CLIENT_ID='test-id';process.env.TWITCH_CLIENT_SECRET='test-secret';
  try{const twitch=new Twitch(()=>{});let cookie,redirect; twitch.login({cookie:(name,value,options)=>{cookie={name,value,options};},redirect:url=>{redirect=new URL(url);}});assert.equal(redirect.origin,'https://id.twitch.tv');assert.equal(redirect.searchParams.get('redirect_uri'),'http://localhost:3000/callback');assert.equal(redirect.searchParams.get('scope'),'user:read:chat user:write:chat user:bot');assert.equal(redirect.searchParams.get('state'),cookie.value);assert.ok(cookie.options.httpOnly);assert.equal(twitch.states.size,1);}finally{if(oldId===undefined)delete process.env.TWITCH_CLIENT_ID;else process.env.TWITCH_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.TWITCH_CLIENT_SECRET;else process.env.TWITCH_CLIENT_SECRET=oldSecret;}
});
test('callback rejects missing or mismatched browser-bound state before token exchange',async()=>{const twitch=new Twitch(()=>{});let status;let body;await twitch.callback({query:{code:'injected',state:'invalid'},headers:{}},{status:n=>{status=n;return{send:s=>{body=s;}};}});assert.equal(status,400);assert.match(body,/Invalid or expired/);assert.equal(twitch.tokens,undefined);});
test('Helix refreshes once on unauthorized and retries with new bearer token',async()=>{const original=global.fetch;const twitch=new Twitch(()=>{});twitch.tokens={access_token:'old',expires_at:Date.now()+3600000};let calls=0,refreshes=0; twitch.refresh=async()=>{refreshes++;twitch.tokens.access_token='new';};global.fetch=async(url,options)=>{calls++;assert.match(url,/helix\/users$/);assert.equal(options.headers.Authorization,calls===1?'Bearer old':'Bearer new');return{status:calls===1?401:200,ok:calls!==1,json:async()=>calls===1?{message:'Expired'}:{data:[{id:'123'}]}};};try{const data=await twitch.api('users');assert.equal(data.data[0].id,'123');assert.equal(calls,2);assert.equal(refreshes,1);}finally{global.fetch=original;}});
test('chat reports dropped messages instead of silently claiming success',async()=>{const twitch=new Twitch(()=>{});twitch.user={id:'123'};twitch.api=async(path,options)=>{assert.equal(path,'chat/messages');const body=JSON.parse(options.body);assert.equal(body.broadcaster_id,'123');assert.equal(body.sender_id,'123');return{data:[{is_sent:false,drop_reason:{message:'Rate limited'}}]};};await assert.rejects(twitch.say('hello'),/Rate limited/);});
test('broadcaster commands and chat are ingested; only marked self replies are ignored', async () => {
  const received = [];
  const twitch = new Twitch(event => received.push(event));
  twitch.user = { id: 'broadcaster' };
  const event = (id, text) => ({ chatter_user_id: id, message: { text } });
  twitch.receiveChat(event('broadcaster', '!bpm'));
  twitch.receiveChat(event('broadcaster', '!ticket'));
  twitch.receiveChat(event('broadcaster', 'lets go!!!'));
  const sent = [];
  twitch.api = async (path, options) => {
    const body = JSON.parse(options.body);
    sent.push(body.message);
    twitch.receiveChat(event('broadcaster', body.message));
    return { data: [{ is_sent: true }] };
  };
  await twitch.say('❤️ Streamer 80 BPM | 🔥 Chat 100 BPM');
  await twitch.say('@broadcaster your ticket: http://localhost:3000/ticket/broadcaster');
  assert.ok(sent.every(message => message.startsWith('[BPM Log] ')));
  assert.deepEqual(received.map(e => e.message.text), ['!bpm', '!ticket', 'lets go!!!']);
  twitch.receiveChat(event('viewer', '[BPM Log] hello'));
  assert.equal(received.length, 4, 'a viewer using the marker is still counted');
});
