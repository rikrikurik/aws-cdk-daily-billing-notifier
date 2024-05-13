import { ResourceName } from './resource-name';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

interface DailyBillingNotifierStackProps extends cdk.StackProps {
  resource_name: ResourceName;
  webhook_url?: string;
  email_address?: string;
}

export class DailyBillingNotifierStack extends cdk.Stack {
  public readonly daily_event: events.Rule;
  public readonly function: lambda.Function;
  public readonly function_role: iam.Role;
  public readonly email_sns_topic_arn: string | undefined;

  constructor(scope: Construct, id: string, props: DailyBillingNotifierStackProps) {
    super(scope, id, props);

    // Create sns subscription and topic if an email address is defined.
    if (props.email_address) {
      const topic_name = props.resource_name.topic_name('email');
      const email_subscription = new subscriptions.EmailSubscription(props.email_address);
      const email_sns_topic = new sns.Topic(this, topic_name, {
        topicName: topic_name,
        displayName: 'Send daily billing info'
      });
      email_sns_topic.addSubscription(email_subscription);
      this.email_sns_topic_arn = email_sns_topic.topicArn;
    }

    // Lambda function role
    const function_name = props.resource_name.lambda_name();
    const function_role_name = `${function_name}-role`;
    this.function_role = new iam.Role(this, function_role_name,
      {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'Daily billing notifier execution role',
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole')],
        roleName: function_role_name,
      }
    );
    this.function_role.addToPolicy(new iam.PolicyStatement({
      actions: [
        "ce:GetCostAndUsage",
        "sns:Publish"
      ],
      effect: iam.Effect.ALLOW,
      resources: ["*"]
    }));

    // Notifier lambda function
    this.function = new lambda.Function(this, function_name,
      {
        functionName: function_name,
        runtime: lambda.Runtime.PYTHON_3_8,
        code: lambda.AssetCode.fromAsset('lambda'),
        handler: 'notifier.handler',
        timeout: cdk.Duration.seconds(300),
        environment: {
          "ACCOUNT_NUMBER": this.account,
          "WEBHOOK_URL": props.webhook_url ? props.webhook_url : "",
          "SNS_TOPIC_ARN": this.email_sns_topic_arn ? this.email_sns_topic_arn : "",
        },
        role: this.function_role,
      }
    );

    // Add daily trigger event
    const rule_name = `${function_name}-eventrule`
    this.daily_event = new events.Rule(this, rule_name, {
      ruleName: rule_name,
      description: "Daily scheduled event for lambda execution",
      schedule: events.Schedule.expression("cron(0 0 * * ? *)")
    });
    this.daily_event.addTarget(new targets.LambdaFunction(this.function));

  }
}
