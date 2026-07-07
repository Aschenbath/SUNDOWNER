import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const helperUrl = new URL('../functions/utils/constantTimeEqual.js', import.meta.url);
const helperPath = fileURLToPath(helperUrl);

function readSource(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('constant-time secret comparison', () => {
  it('provides a shared helper for secret string equality', async () => {
    assert.equal(fs.existsSync(helperPath), true, 'secret comparisons should use a shared helper');

    const { constantTimeEqual } = await import(helperUrl.href);

    assert.equal(constantTimeEqual('secret', 'secret'), true);
    assert.equal(constantTimeEqual('secret', 'secreu'), false);
    assert.equal(constantTimeEqual('secret', 'secret-longer'), false);
    assert.equal(constantTimeEqual('', ''), true);
    assert.equal(constantTimeEqual('secret', null), false);
    assert.equal(constantTimeEqual(undefined, 'secret'), false);
  });

  it('routes sensitive credential checks through the shared helper', () => {
    const loginSource = readSource('../functions/api/login.js');
    const manageMiddlewareSource = readSource('../functions/api/manage/_middleware.js');
    const authSessionSource = readSource('../functions/api/manage/auth-session.js');
    const adminSessionHelperSource = readSource('../functions/utils/adminSession.js');
    const dualAuthSource = readSource('../functions/utils/dualAuth.js');
    const userAuthSource = readSource('../functions/utils/userAuth.js');
    const webDavSource = readSource('../functions/dav/[[path]].js');
    const telegramSource = readSource('../functions/utils/telegramSync.js');
    const tokenValidatorSource = readSource('../functions/utils/tokenValidator.js');
    const apiTokensSource = readSource('../functions/api/manage/apiTokens.js');

    assert.match(loginSource, /constantTimeEqual\(authCode,\s*rightAuthCode\)/);
    assert.doesNotMatch(loginSource, /authCode\s*!==\s*rightAuthCode/);

    assert.match(manageMiddlewareSource, /constantTimeEqual\(user,\s*basicUser\)/);
    assert.match(manageMiddlewareSource, /constantTimeEqual\(pass,\s*basicPass\)/);
    assert.doesNotMatch(manageMiddlewareSource, /basicUser\s*!==\s*user\s*\|\|\s*basicPass\s*!==\s*pass/);

    assert.match(authSessionSource, /constantTimeEqual\(username,\s*rightUser\)/);
    assert.match(authSessionSource, /constantTimeEqual\(password,\s*rightPass\)/);
    assert.doesNotMatch(authSessionSource, /username\s*!==\s*rightUser\s*\|\|\s*password\s*!==\s*rightPass/);

    assert.match(adminSessionHelperSource, /constantTimeEqual\(signature,\s*expectedSignature\)/);
    assert.doesNotMatch(adminSessionHelperSource, /expectedSignature\.length\s*!==\s*signature\.length/);

    assert.match(dualAuthSource, /constantTimeEqual\(user,\s*basicUser\)/);
    assert.match(dualAuthSource, /constantTimeEqual\(pass,\s*basicPass\)/);
    assert.doesNotMatch(dualAuthSource, /user\s*===\s*basicUser\s*&&\s*pass\s*===\s*basicPass/);

    assert.match(userAuthSource, /constantTimeEqual\(authCode,\s*rightAuthCode\)/);
    assert.doesNotMatch(userAuthSource, /authCode\.length\s*!==\s*rightAuthCode\.length/);

    assert.match(webDavSource, /constantTimeEqual\(user,\s*davUser\)/);
    assert.match(webDavSource, /constantTimeEqual\(pass,\s*davPass\)/);
    assert.doesNotMatch(webDavSource, /user\s*!==\s*davUser\s*\|\|\s*pass\s*!==\s*davPass/);

    assert.match(telegramSource, /constantTimeEqual\(providedSecret,\s*channel\.webhookSecret\)/);
    assert.doesNotMatch(telegramSource, /providedSecret\s*!==\s*channel\.webhookSecret/);

    assert.doesNotMatch(tokenValidatorSource, /tokens\[tokenId\]\.token\s*===\s*token/);
    assert.doesNotMatch(tokenValidatorSource, /constantTimeEqual\(tokens\[tokenId\]\.token,\s*token\)/);

    assert.match(apiTokensSource, /constantTimeEqual\(computedHash,\s*tokenData\.tokenHash\)/);
    assert.match(apiTokensSource, /constantTimeEqual\(tokenData\.token,\s*token\)/);
    assert.doesNotMatch(apiTokensSource, /tokens\[tokenId\]\.token\s*===\s*token/);
  });
});
