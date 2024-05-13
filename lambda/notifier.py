import os
import boto3
import logging
import json
import requests
from datetime import datetime, timedelta, date

ACCOUNT_NUMBER = os.environ['ACCOUNT_NUMBER']
WEBHOOK_URL = os.environ['WEBHOOK_URL']
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']


logger = logging.getLogger()
logger.setLevel(logging.INFO)
formatter = logging.Formatter(
    '[%(levelname)s]\t%(asctime)s.%(msecs)dZ\t%(aws_request_id)s\t%(filename)s\t%(funcName)s\t%(lineno)d\t%(message)s\n',
    '%Y-%m-%dT%H:%M:%S'
)
for handler in logger.handlers:
    handler.setFormatter(formatter)


def get_total_billing_amount(client) -> dict:
    """Get total billing amount from AWS Cost Explorer API"""
    (start_date, end_date) = get_total_cost_date_range()
    response = client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date,
            'End': end_date
        },
        Granularity='MONTHLY',
        Metrics=['AmortizedCost']
    )
    return {
        'start':
        response['ResultsByTime'][0]['TimePeriod']['Start'],
        'end':
        response['ResultsByTime'][0]['TimePeriod']['End'],
        'billing':
        response['ResultsByTime'][0]['Total']['AmortizedCost']['Amount'],
    }


def get_per_service_billing_amount(client) -> list:
    """Get per service billing amount from AWS Cost Explorer API"""
    (start_date, end_date) = get_total_cost_date_range()
    response = client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date,
            'End': end_date
        },
        Granularity='MONTHLY',
        Metrics=['AmortizedCost'],
        GroupBy=[{
            'Type': 'DIMENSION',
            'Key': 'SERVICE'
        }])

    billings = []

    for item in response['ResultsByTime'][0]['Groups']:
        billings.append({
            'service_name': item['Keys'][0],
            'billing': item['Metrics']['AmortizedCost']['Amount']
        })
    return billings


def generate_send_message(total_billing: dict, service_billings: list) -> (str, str):
    """Generate message for sending"""
    start = datetime.strptime(total_billing['start'],
                              '%Y-%m-%d').strftime('%m/%d')
    today = datetime.strptime(total_billing['end'], '%Y-%m-%d')
    end = (today - timedelta(days=1)).strftime('%m/%d')
    total = round(float(total_billing['billing']), 2)

    summary = (
        f' ({start}-{end}): {total:.2f} USD'
    )

    details = []
    for item in service_billings:
        service_name = item['service_name']
        billing = round(float(item['billing']), 2)

        if billing == 0.0:
            continue
        details.append(f'- {service_name}: {billing:.2f} USD')

    def pick_notification_color(total_cost):
        if total_cost < 15:
            return 5620992
        elif total_cost < 30:
            return 14912796
        else:
            return 13382451

    return summary, '\n'.join(details), pick_notification_color(total)


def get_total_cost_date_range() -> (str, str):
    """Get date range to calculate total cost using AWS Cost Explorer API"""
    start_date = get_begin_of_month()
    end_date = get_today()
    if start_date == end_date:
        end_of_month = datetime.strptime(start_date,
                                         '%Y-%m-%d') + timedelta(days=-1)
        begin_of_month = end_of_month.replace(day=1)
        return begin_of_month.date().isoformat(), end_date
    return start_date, end_date


def get_begin_of_month() -> str:
    """Get the first day of the month in ISO format"""
    return date.today().replace(day=1).isoformat()


def get_prev_day(prev: int) -> str:
    """Get the date of the previous day in ISO format"""
    return (date.today() - timedelta(days=prev)).isoformat()


def get_today() -> str:
    """Get today's date in ISO format"""
    return date.today().isoformat()


def send_to_discord_webhook(summary: str, details: str, embed_color) -> None:
    """Send message to Discord webhook"""
    # Generate request body
    username = 'AWS Daily Billing Notifier'
    description = "\nPer Service Billing\n" + (details if details else "- No billing until today")
    payload = {
        "username": username,
        "embeds": [
            {
                "title": f"ACCOUNT: {ACCOUNT_NUMBER}" + summary,
                "color": embed_color,
                "description": description,
            }
        ]
    }

    # Send request
    endpoint = WEBHOOK_URL + "?wait=true"
    response = requests.post(endpoint, json=payload)
    logger.info(response.status_code)
    logger.info(json.dumps(json.loads(response.content),
                indent=4, ensure_ascii=False))


def send_to_sns_topic(title: str, detail: str) -> None:
    """Send message to SNS topic"""
    sns_client = boto3.client('sns')
    sns_response = sns_client.publish(TopicArn=SNS_TOPIC_ARN,
                                      Subject=title,
                                      Message=detail)
    logging.info(f"{sns_response=}")


def handler(event, context) -> None:
    """Main handler function"""
    client = boto3.client('ce', region_name='us-east-1')
    # Get billing info
    total_billing = get_total_billing_amount(client)
    service_billings = get_per_service_billing_amount(client)
    # create message
    (summary, detail, color) = generate_send_message(total_billing, service_billings)
    logger.info(f'{summary=}, {detail=}')
    # send message
    if WEBHOOK_URL:
        logger.info(f'Send to webhook url {WEBHOOK_URL}')
        send_to_discord_webhook(summary, detail, color)
    if SNS_TOPIC_ARN:
        logger.info(f'Send to sns topic arn {SNS_TOPIC_ARN}')
        send_to_sns_topic(summary, detail)
