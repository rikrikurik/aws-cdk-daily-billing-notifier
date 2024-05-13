import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { ResourceName } from '../lib/resource-name';
import { DailyBillingNotifierStack } from '../lib/daily-billing-notifier-stack';

test('Empty Stack', () => {
  const app = new cdk.App();
  // WHEN
  const resource_name = new ResourceName("test", "test")
  const stack = new DailyBillingNotifierStack(app, 'NotifierTestStack', {
    stackName: ('notifier-test'),
    resource_name: resource_name,
  })

  // THEN
  expectCDK(stack).to(matchTemplate({
    "Resources": {}
  }, MatchStyle.EXACT))
});
