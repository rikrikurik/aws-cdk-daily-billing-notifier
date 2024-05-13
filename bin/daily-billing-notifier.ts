#!/usr/bin/env node
import { ResourceName } from '../lib/resource-name';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DailyBillingNotifierStack } from '../lib/daily-billing-notifier-stack';

const app = new cdk.App();

// Get Context
const system_name = app.node.tryGetContext("system_name");
const resource_name = new ResourceName(system_name);

// Get destination info from the cdk.context.
const email_address = app.node.tryGetContext("mail");
const webhook_url = app.node.tryGetContext("webhook");
// throw error if any destination is not defined.
if (!email_address && !webhook_url) {
  throw new Error(`destination undefined. Please define by context option:
  --context mail=<destination email address>
  and/or
  --context webhook=<destination webhook url>`);
}

// Deploy notifier
const stack = new DailyBillingNotifierStack(app, 'notifier',
  {
    stackName: resource_name.stack_name(),
    resource_name: resource_name,
    webhook_url: webhook_url,
    email_address: email_address
  })

// Tagging
cdk.Tags.of(stack).add("system", system_name)

