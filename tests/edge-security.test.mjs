import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function handler(file, { master = false, admin = false, secrets = {}, rpc, permission, auth = {}, from } = {}) {
  let endpoint;
  let databaseAccess = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'caller', email: 'caller@example.test' } } }), ...auth },
    from: (...args) => { databaseAccess++; if (from) return from(...args); throw new Error('Unexpected database access'); },
    rpc: (...args) => { databaseAccess++; if (rpc) return rpc(...args); throw new Error('Unexpected database access'); },
  };
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports: {}, Response, Request, Headers, crypto,
    console: { log() {}, error() {} },
    Deno: { env: { get: key => secrets[key] } },
    require: name => {
      if (name.includes('authorization')) return { isMaster: async () => master, canManageChurch: async () => admin, callerPermission: permission ?? (async () => admin) };
      if (name.includes('http/server')) return { serve: fn => { endpoint = fn; } };
      if (name.includes('supabase-js')) return { createClient: () => client };
      if (name.includes('stripe')) return { default: class {} };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { invoke: body => endpoint(new Request('https://example.test', {
    method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })), databaseAccess: () => databaseAccess };
}

test('leader password reset uses the scoped target and never permits setting a password', async () => {
  const sent = [];
  const permission = async (_req, name, args) => {
    assert.equal(name, 'can_manage_team_user');
    return args._target === 'teammate' && args._church_id === 'church-a';
  };
  const app = handler('supabase/functions/admin-manage-password/index.ts', {
    permission,
    rpc: async name => { assert.equal(name, 'is_church_admin_of_user'); return { data: false }; },
    auth: {
      admin: { getUserById: async id => { assert.equal(id, 'teammate'); return { data: { user: { email: 'verified@example.test' } } }; } },
      resetPasswordForEmail: async email => { sent.push(email); return {}; },
    },
    from: table => ({ select: () => ({ eq: () => table === 'platform_admin'
      ? { maybeSingle: async () => ({ data: null }) }
      : Promise.resolve({ data: [{ church_id: 'church-a' }, { church_id: 'church-b' }] }) }) }),
  });
  for (const body of [
    { action: 'set', targetUserId: 'teammate', churchId: 'church-a', newPassword: 'DoNotSet123!' },
    { action: 'reset', targetUserId: 'outsider', churchId: 'church-a' },
    { action: 'reset', targetUserId: 'teammate', churchId: 'church-b' },
    { action: 'reset', targetUserId: 'teammate' },
  ]) assert.equal((await app.invoke(body)).status, 403);
  assert.deepEqual(sent, []);
  assert.equal((await app.invoke({ action: 'reset', targetUserId: 'teammate', churchId: 'church-a' })).status, 200);
  assert.deepEqual(sent, ['verified@example.test']);
});

test('create-user forwards team scope and rolls back Auth when provisioning fails', async () => {
  const removed = [];
  const app = handler('supabase/functions/create-user/index.ts', {
    permission: async (_req, name, args) => {
      assert.equal(name, 'can_create_church_user');
      assert.equal(args._role, 'volunteer');
      assert.deepEqual(Array.from(args._ministries), ['team-a']);
      return true;
    },
    rpc: async (name, args) => {
      if (name === 'can_add_church_user') return { data: true };
      assert.equal(name, 'provision_church_user');
      assert.equal(args._caller, 'caller');
      assert.equal(args._user_id, 'created');
      assert.deepEqual(Array.from(args._ministries), ['team-a']);
      return { error: new Error('Leadership revoked') };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    auth: { admin: {
      createUser: async () => ({ data: { user: { id: 'created' } } }),
      deleteUser: async id => { removed.push(id); return {}; },
    } },
  });
  assert.equal((await app.invoke({ email: 'new@example.test', fullName: 'New User', role: 'volunteer', churchId: 'church-a', ministryIds: ['team-a'] })).status, 500);
  assert.deepEqual(removed, ['created']);
});

test('integration list never returns configured secret values, even to Master', async () => {
  const secrets = Object.fromEntries(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY',
    'LOVABLE_API_KEY', 'VAPID_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].map(k => [k, `private-${k}-sentinel`]));
  const app = handler('supabase/functions/admin-integrations/index.ts', { master: true, secrets });
  const response = await app.invoke({ action: 'list' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.text();
  for (const secret of Object.values(secrets)) assert.ok(!body.includes(secret));
  assert.ok(JSON.parse(body).integrations.length > 0);
});

test('ordinary users cannot list integrations', async () => {
  const app = handler('supabase/functions/admin-integrations/index.ts');
  assert.equal((await app.invoke({ action: 'list' })).status, 403);
});

test('only Master can delete a church and the server requires confirmation', async () => {
  const body = { action: 'delete_church', churchId: '00000000-0000-4000-8000-000000000002', confirmationName: 'Test Church' };
  const denied = handler('supabase/functions/admin-financial/index.ts');
  assert.equal((await denied.invoke(body)).status, 403);
  assert.equal(denied.databaseAccess(), 0);
  const master = handler('supabase/functions/admin-financial/index.ts', { master: true, rpc: async (name, args) => {
    assert.equal(name, 'delete_church_account');
    assert.equal(args._church_id, body.churchId);
    assert.equal(args._confirmation_name, body.confirmationName);
    return { error: null };
  }});
  assert.equal((await master.invoke({ ...body, confirmationName: '' })).status, 400);
  assert.equal(master.databaseAccess(), 0);
  assert.equal((await master.invoke(body)).status, 200);
  const blocked = handler('supabase/functions/admin-financial/index.ts', {
    master: true, rpc: async () => ({ error: { message: 'Conta vinculada ao Stripe' } }),
  });
  const response = await blocked.invoke(body);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'Conta vinculada ao Stripe');
});

test('create-user and checkout deny another church before privileged operations', async () => {
  for (const name of ['create-user', 'create-checkout', 'send-invite']) {
    const app = handler(`supabase/functions/${name}/index.ts`);
    const response = await app.invoke({ churchId: 'other-church', email: 'member@example.test', role: 'admin', plan: 'basic' });
    assert.equal(response.status, 403, name);
    assert.equal(app.databaseAccess(), 0, name);
  }
});
