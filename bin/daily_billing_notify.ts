#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { DailyBillingNotifyStack } from '../lib/daily_billing_notify-stack';

const app = new cdk.App();
new DailyBillingNotifyStack(app, 'DailyBillingNotifyStack');
