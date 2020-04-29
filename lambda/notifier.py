import os
import boto3
import json
import urllib.request as urlrequest
from datetime import datetime, timedelta, date

ACCOUNT_NUMBER = os.environ['ACCOUNT_NUMBER']
WEBHOOK_URL = os.environ['WEBHOOK_URL']
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']


def lambda_handler(event, context) -> None:
    client = boto3.client('ce', region_name='us-east-1')
    # Get billing info
    total_billing = get_total_billing(client)
    service_billings = get_service_billings(client)
    # create message
    (title, detail) = create_message(total_billing, service_billings)
    # send message
    if WEBHOOK_URL:
        print(f'Send to webhook url {WEBHOOK_URL}')
        send_to_webhook(title, detail)
    if SNS_TOPIC_ARN:
        print(f'Send to sns topic arn {SNS_TOPIC_ARN}')
        send_to_sns_topic(title, detail)


def get_total_billing(client) -> dict:
    (start_date, end_date) = get_total_cost_date_range()
    response = client.get_cost_and_usage(TimePeriod={
        'Start': start_date,
        'End': end_date
    },
        Granularity='MONTHLY',
        Metrics=['AmortizedCost'])
    return {
        'start':
        response['ResultsByTime'][0]['TimePeriod']['Start'],
        'end':
        response['ResultsByTime'][0]['TimePeriod']['End'],
        'billing':
        response['ResultsByTime'][0]['Total']['AmortizedCost']['Amount'],
    }


def get_service_billings(client) -> list:
    (start_date, end_date) = get_total_cost_date_range()
    response = client.get_cost_and_usage(TimePeriod={
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


def create_message(total_billing: dict, service_billings: list) -> (str, str):
    start = datetime.strptime(total_billing['start'],
                              '%Y-%m-%d').strftime('%m/%d')
    today = datetime.strptime(total_billing['end'], '%Y-%m-%d')
    end = (today - timedelta(days=1)).strftime('%m/%d')
    total = round(float(total_billing['billing']), 2)

    title = f'[AWS daily billing notify] {ACCOUNT_NUMBER} ({start}-{end}): {total:.2f} USD.'

    details = []
    for item in service_billings:
        service_name = item['service_name']
        billing = round(float(item['billing']), 2)

        if billing == 0.0:
            continue
        details.append(f'　・{service_name}: {billing:.2f} USD')

    return title, '\n'.join(details)


def get_total_cost_date_range() -> (str, str):
    start_date = get_begin_of_month()
    end_date = get_today()
    if start_date == end_date:
        end_of_month = datetime.strptime(start_date,
                                         '%Y-%m-%d') + timedelta(days=-1)
        begin_of_month = end_of_month.replace(day=1)
        return begin_of_month.date().isoformat(), end_date
    return start_date, end_date


def get_begin_of_month() -> str:
    return date.today().replace(day=1).isoformat()


def get_prev_day(prev: int) -> str:
    return (date.today() - timedelta(days=prev)).isoformat()


def get_today() -> str:
    return date.today().isoformat()


def send_to_webhook(title: str, detail: str) -> None:
    send_data = {
        "username": "AWS daily billing",
        'color': '#36a64f',
        'pretext': title,
        'text': detail
    }
    request = urlrequest.Request(
        WEBHOOK_URL,
        data=("payload=" + json.dumps(send_data)).encode('utf-8'),
        method="POST"
    )
    with urlrequest.urlopen(request) as response:
        response_body = response.read().decode('utf-8')
        print(response_body)


def send_to_sns_topic(title: str, detail: str) -> None:
    sns_client = boto3.client('sns')
    response = sns_client.publish(TopicArn=SNS_TOPIC_ARN,
                                  Subject=title,
                                  Message=detail)
    print(response)
