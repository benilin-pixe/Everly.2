/**
 * Everly Authentication & Password Setup Test Suite
 */

const BASE_URL = 'http://localhost:3000';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAuthTests() {
  console.log('=== STARTING EVERLY AUTHENTICATION & PASSWORD SETUP TESTS ===\n');

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

  // TEST 1: Invalid input - missing fields (400)
  console.log('--- 1. Testing Input Validation (400) ---');
  const resEmpty = await fetch(`${BASE_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const dataEmpty = await resEmpty.json();
  assert('Missing email and password returns 400 Bad Request', resEmpty.status === 400);
  assert('Response includes requestId and error notice', Boolean(dataEmpty.requestId && dataEmpty.error));

  const resShortPass = await fetch(`${BASE_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'benilin76@gmail.com', password: '123' }),
  });
  assert('Password shorter than 6 characters returns 400 Bad Request', resShortPass.status === 400);

  // TEST 2: Unauthorized account rejection (403)
  console.log('\n--- 2. Testing Authorization & Two-Owner Whitelist (403) ---');
  const resStranger = await fetch(`${BASE_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'stranger@external.com', password: 'validpassword123' }),
  });
  const dataStranger = await resStranger.json();
  assert('Unauthorized 3rd-party user returns 403 Forbidden', resStranger.status === 403);
  assert('Unauthorized message explains whitelist restriction', dataStranger.error.includes('not an authorized Everly owner'));

  // TEST 3: Successful Password Setup for Owner 1 (BeniLin)
  console.log('\n--- 3. Testing Successful Password Setup for Owner 1 (BeniLin) ---');
  const benilinPassword = 'BeniSecurePassword2026!';
  const resBenSetup = await fetch(`${BASE_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'benilin76@gmail.com', password: benilinPassword }),
  });
  const dataBenSetup = await resBenSetup.json();
  assert('Setup returns 200 OK for Owner 1 (benilin76@gmail.com)', resBenSetup.status === 200);
  assert('Returns success: true and sanitized user object', Boolean(dataBenSetup.success && dataBenSetup.user));
  assert('Returns session token and requestId', Boolean(dataBenSetup.token && dataBenSetup.requestId));
  assert('NEVER exposes passwordHash to client', dataBenSetup.user.passwordHash === undefined);
  assert('NEVER exposes passwordSalt to client', dataBenSetup.user.passwordSalt === undefined);
  assert('User role remains Owner', dataBenSetup.user.role === 'Owner');

  // TEST 4: Successful Password Setup for Owner 2 (Shana Love)
  console.log('\n--- 4. Testing Successful Password Setup for Owner 2 (Shana Love) ---');
  const shanaPassword = 'ShanaSecurePassword2026!';
  const resShanaSetup = await fetch(`${BASE_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shanalove917@gmail.com', password: shanaPassword }),
  });
  const dataShanaSetup = await resShanaSetup.json();
  assert('Setup returns 200 OK for Owner 2 (shanalove917@gmail.com)', resShanaSetup.status === 200);
  assert('Owner 2 credentials never expose passwordHash', dataShanaSetup.user.passwordHash === undefined);
  assert('Owner 2 credentials never expose passwordSalt', dataShanaSetup.user.passwordSalt === undefined);

  // TEST 5: Account Isolation & Two-Owner Credential Separation
  console.log('\n--- 5. Testing Account Isolation ---');
  // Log in as BeniLin with BeniLin's password -> must succeed
  const resBenLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'benilin76@gmail.com', password: benilinPassword }),
  });
  assert('Owner 1 can log in with newly configured password', resBenLogin.status === 200);

  // Attempt to log in as Shana Love with BeniLin's password -> must fail (401)
  const resCrossLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shanalove917@gmail.com', password: benilinPassword }),
  });
  assert('Owner 2 cannot be accessed with Owner 1 password (401 Isolation confirmed)', resCrossLogin.status === 401);

  // Log in as Shana Love with Shana Love's password -> must succeed
  const resShanaLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'shanalove917@gmail.com', password: shanaPassword }),
  });
  assert('Owner 2 can log in with her own password', resShanaLogin.status === 200);

  // TEST 6: Safe Retries (Idempotency without account corruption)
  console.log('\n--- 6. Testing Safe Retry ---');
  const resRetry = await fetch(`${BASE_URL}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'benilin76@gmail.com', password: benilinPassword }),
  });
  assert('Retrying setup succeeds safely without duplicating records or throwing 500', resRetry.status === 200);

  // TEST 7: Public Registration Permanently Retired (410)
  console.log('\n--- 7. Testing Public Registration Block ---');
  const resReg = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST' });
  assert('Public registration returns 410 Gone', resReg.status === 410);

  // TEST 8: Serverless & ESM Native Module Resolution (Zero 500 boot crashes)
  console.log('\n--- 8. Testing Serverless ESM Module Resolution ---');
  try {
    const apiModule = await import('../api/index.ts');
    assert('api/index.ts imports successfully without ERR_MODULE_NOT_FOUND', typeof apiModule.default === 'function');
    const apiCatchAll = await import('../api/[...all].ts');
    assert('api/[...all].ts imports successfully without ERR_MODULE_NOT_FOUND', typeof apiCatchAll.default === 'function');
    const serverModule = await import('../server.ts');
    assert('server.ts imports cleanly without crashing', typeof serverModule.default === 'function');
  } catch (err: any) {
    assert(`Serverless ESM import threw: ${err?.message}`, false);
  }

  // TEST 9: Firebase Configuration & Database ID Integrity
  console.log('\n--- 9. Testing Firebase Project & Database Verification ---');
  const fbConfig = (await import('../firebase-applet-config.json', { with: { type: 'json' } })).default;
  assert('Firebase config has verified project ID', fbConfig.projectId === 'gen-lang-client-0012308220');
  assert('Firebase config has exact named database ID', fbConfig.firestoreDatabaseId === 'ai-studio-everly-cd5ac139-cf00-4957-bc41-efe152baebda');

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAuthTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
