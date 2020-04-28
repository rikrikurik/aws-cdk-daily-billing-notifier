import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as DailyBillingNotify from '../lib/daily_billing_notify-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new DailyBillingNotify.DailyBillingNotifyStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
