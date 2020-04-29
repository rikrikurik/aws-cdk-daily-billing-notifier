#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ResourceName } from '../lib/resource_name';
import { NotifierStack } from '../lib/notifier';

const app = new cdk.App();

// Define stack env
const stack_env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
}

// Get Context
const system_name = app.node.tryGetContext("system_name")
const system_env = app.node.tryGetContext("env")
const resource_name = new ResourceName(system_name, system_env)

// Get destination info from the cdk.context.
const email_address = app.node.tryGetContext("mail")
const webhook_url = app.node.tryGetContext("webhook")
// throw error if any destination is not defined.
if (!email_address && !webhook_url) {
  throw new Error(`destination undefined. Please define by context option:
  --context mail=<destination email address>
  and/or
  --context webhook=<destination webhook url>`);
}

// Deploy notifier
const notifier_stack = new NotifierStack(app, 'notifier',
  {
    stackName: resource_name.stack_name('notifier'),
    env: stack_env,
    resource_name: resource_name,
    webhook_url: webhook_url,
    email_address: email_address
  })

// Tagging
cdk.Tag.add(notifier_stack, "system", system_name)
cdk.Tag.add(notifier_stack, "env", system_env)

