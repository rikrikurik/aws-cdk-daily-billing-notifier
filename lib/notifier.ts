import * as cdk from '@aws-cdk/core';
import iam = require('@aws-cdk/aws-iam');
import events = require('@aws-cdk/aws-events');
import targets = require('@aws-cdk/aws-events-targets');
import lambda = require('@aws-cdk/aws-lambda');
// import dest = require('@aws-cdk/aws-lambda-destinations');
import sns = require('@aws-cdk/aws-sns');
import subscriptions = require('@aws-cdk/aws-sns-subscriptions');
import { ResourceName } from '../lib/resource_name';

interface NotifierStackProps extends cdk.StackProps {
  resource_name: ResourceName;
  webhook_url?: string;
  email_address?: string;
}

export class NotifierStack extends cdk.Stack {
  public readonly daily_event: events.Rule;
  public readonly function: lambda.Function;
  public readonly function_role: iam.Role;
  public readonly email_sns_topic: sns.Topic;
  public readonly email_subscription: subscriptions.EmailSubscription;

  constructor(scope: cdk.Construct, id: string, props: NotifierStackProps) {
    super(scope, id, props);

    // Create sns subscription and topic if an email address is defined.
    if (props.email_address) {
      const topic_name = props.resource_name.topic_name('billing')
      this.email_subscription = new subscriptions.EmailSubscription(props.email_address)
      this.email_sns_topic = new sns.Topic(this, topic_name, {
        topicName: topic_name,
        displayName: 'Send daily billing info'
      })
      this.email_sns_topic.addSubscription(this.email_subscription)
    }

    // Lambda function role
    const function_name = props.resource_name.lambda_name('notifier')
    const function_role_name = `${function_name}-role`
    this.function_role = new iam.Role(this, function_role_name,
      {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'Daily billing infomation notifier execution role',
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole')],
        roleName: function_role_name
      }
    )
    this.function_role.addToPolicy(new iam.PolicyStatement({
      actions: [
        "ce:GetCostAndUsage",
        "sns:Publish"
      ],
      effect: iam.Effect.ALLOW,
      resources: ["*"]
    }))

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
          "SNS_TOPIC_ARN": this.email_sns_topic ? this.email_sns_topic.topicArn : ""
        },
        role: this.function_role
      }
    )

    // Add daily trigger event
    const rule_name = `${function_name}-eventrule`
    this.daily_event = new events.Rule(this, rule_name, {
      ruleName: rule_name,
      description: "Daily scheduled event for lambda execution",
      schedule: events.Schedule.expression("cron(0 0 * * ? *)")
    })
    this.daily_event.addTarget(new targets.LambdaFunction(this.function));

  }
}
