import { useState, type DragEvent } from 'react'
import './App.css'

type Mode = 'easy' | 'medium' | 'hard'

type Service = {
  name: string
  mark: string
  hint: string
}

type Challenge = {
  title: string
  context: string
  prompt: string
  correct: string
  explanation: string
  takeaway: string
  flow: { name: string; mark: string; missing?: boolean }[]
  choices: Service[]
  repairs?: { prompt: string; correct: string; explanation: string; takeaway: string; choices: Service[] }[]
}

const modeDetails: Record<Mode, { label: string; audience: string; points: number }> = {
  easy: { label: 'Easy', audience: 'New to AWS', points: 100 },
  medium: { label: 'Medium', audience: 'Know the basics', points: 200 },
  hard: { label: 'Hard', audience: 'AWS practitioners', points: 300 },
}

function shuffleChoices(choices: Service[]) {
  const shuffled = [...choices]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentChoice = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = currentChoice
  }
  return shuffled
}

const challenges: Record<Mode, Challenge[]> = {
  easy: [
    {
      title: 'Put a product catalog online',
      context: 'A small shop needs to store product photos and serve them to customers.',
      prompt: 'Which service is missing from this static asset delivery path?',
      correct: 'Amazon S3',
      explanation:
        'Amazon Simple Storage Service (S3) stores files as objects inside buckets. It is durable, scales automatically, and is a common home for images, documents, and static website assets.',
      takeaway: 'Think of S3 as a virtually unlimited file cabinet, addressed by bucket and object key.',
      flow: [
        { name: 'Shoppers', mark: '01' },
        { name: 'CloudFront', mark: 'CF' },
        { name: 'Missing service', mark: '?', missing: true },
      ],
      choices: [
        { name: 'Amazon S3', mark: 'S3', hint: 'Object storage' },
        { name: 'Amazon SQS', mark: 'SQS', hint: 'Message queue' },
        { name: 'Amazon RDS', mark: 'RDS', hint: 'Relational database' },
      ],
    },
    {
      title: 'Save a user’s preferences',
      context: 'A serverless app needs a fast database that can grow with unpredictable traffic.',
      prompt: 'Which managed database completes this serverless stack?',
      correct: 'Amazon DynamoDB',
      explanation:
        'DynamoDB is a managed NoSQL key-value and document database. AWS handles the underlying servers, and it can scale to handle very large request volumes with consistently low latency.',
      takeaway: 'Reach for DynamoDB when you need key-based access at scale without managing database servers.',
      flow: [
        { name: 'Web app', mark: 'WEB' },
        { name: 'AWS Lambda', mark: 'λ' },
        { name: 'Missing service', mark: '?', missing: true },
      ],
      choices: [
        { name: 'Amazon DynamoDB', mark: 'DB', hint: 'NoSQL database' },
        { name: 'Amazon SNS', mark: 'SNS', hint: 'Pub/sub messaging' },
        { name: 'Amazon EBS', mark: 'EBS', hint: 'Block storage' },
      ],
    },
    {
      title: 'Find out when things go wrong',
      context: 'An app is live. The team needs logs, metrics, and alarms in one place.',
      prompt: 'Which service gives the team visibility into this app?',
      correct: 'Amazon CloudWatch',
      explanation:
        'Amazon CloudWatch collects metrics and logs from AWS resources and applications. You can build dashboards and alarms, such as notifying the team when error rates rise.',
      takeaway: 'CloudWatch helps answer: “What is happening in my system right now?”',
      flow: [
        { name: 'Application', mark: 'APP' },
        { name: 'AWS Lambda', mark: 'λ' },
        { name: 'Missing service', mark: '?', missing: true },
      ],
      choices: [
        { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Monitoring & logs' },
        { name: 'Amazon Route 53', mark: 'R53', hint: 'DNS service' },
        { name: 'Amazon ECR', mark: 'ECR', hint: 'Container registry' },
      ],
    },
  ],
  medium: [
    {
      title: 'Smooth out a traffic spike',
      context: 'Checkout traffic surges. You want requests buffered so workers can process them steadily.',
      prompt: 'Which service decouples the API from background workers?',
      correct: 'Amazon SQS',
      explanation:
        'Amazon Simple Queue Service (SQS) is a managed message queue. Producers add messages, and consumers process them when ready. This decouples services and absorbs short bursts of work.',
      takeaway: 'A queue gives downstream workers time to catch up without making the caller wait.',
      flow: [
        { name: 'Shoppers', mark: '01' },
        { name: 'Checkout API', mark: 'API' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Worker fleet', mark: 'EC2' },
      ],
      choices: [
        { name: 'Amazon SQS', mark: 'SQS', hint: 'Durable message queue' },
        { name: 'Amazon Kinesis', mark: 'KIN', hint: 'Streaming data' },
        { name: 'Amazon ElastiCache', mark: 'EC', hint: 'In-memory cache' },
      ],
      repairs: [
        {
          prompt: 'Which compute service should consume queued checkout work?',
          correct: 'AWS Lambda',
          explanation: 'Lambda can consume SQS messages and run checkout work without managing a server fleet.',
          takeaway: 'Use an event source mapping to let Lambda poll and process messages from SQS.',
          choices: [
            { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven compute' },
            { name: 'Amazon ECS', mark: 'ECS', hint: 'Container orchestration' },
            { name: 'Amazon Lightsail', mark: 'LS', hint: 'Simple virtual servers' },
          ],
        },
        {
          prompt: 'Where should the worker persist completed order data?',
          correct: 'Amazon DynamoDB',
          explanation: 'DynamoDB provides managed key-value and document storage for order records at variable scale.',
          takeaway: 'Choose a data store around access patterns and consistency needs.',
          choices: [
            { name: 'Amazon DynamoDB', mark: 'DB', hint: 'Managed NoSQL database' },
            { name: 'Amazon EFS', mark: 'EFS', hint: 'Shared file storage' },
            { name: 'Amazon OpenSearch', mark: 'OS', hint: 'Search and analytics' },
          ],
        },
      ],
    },
    {
      title: 'Spread requests across servers',
      context: 'Route 53 directs web traffic to a load-balanced EC2 fleet with health and capacity monitoring.',
      prompt: 'Which service routes incoming HTTP traffic to healthy instances?',
      correct: 'Application Load Balancer',
      explanation:
        'An Application Load Balancer (ALB) operates at the HTTP layer. It distributes requests across targets, checks their health, and supports routing based on host or URL path.',
      takeaway: 'Pair an ALB with multiple targets so one unhealthy instance does not take the app offline.',
      flow: [
        { name: 'Web clients', mark: 'WEB' },
        { name: 'Route 53', mark: 'R53' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'EC2 instances', mark: 'EC2' },
        { name: 'Missing service', mark: '?', missing: true },
      ],
      choices: [
        { name: 'Application Load Balancer', mark: 'ALB', hint: 'HTTP traffic routing' },
        { name: 'AWS Transit Gateway', mark: 'TGW', hint: 'Network connectivity' },
        { name: 'Amazon API Gateway', mark: 'API', hint: 'Managed API front door' },
      ],
      repairs: [
        {
          prompt: 'Which service runs the web tier across multiple instances?',
          correct: 'Amazon EC2 Auto Scaling',
          explanation: 'EC2 Auto Scaling adjusts the number of instances to maintain capacity as demand changes.',
          takeaway: 'An Auto Scaling group supplies targets that the load balancer can health-check.',
          choices: [
            { name: 'Amazon EC2 Auto Scaling', mark: 'ASG', hint: 'Scalable instance fleet' },
            { name: 'AWS Fargate', mark: 'FG', hint: 'Serverless containers' },
            { name: 'AWS Batch', mark: 'BATCH', hint: 'Batch job scheduling' },
          ],
        },
        {
          prompt: 'Which service can collect instance metrics and trigger alarms?',
          correct: 'Amazon CloudWatch',
          explanation: 'CloudWatch collects AWS metrics and can alert the team when health or capacity thresholds are crossed.',
          takeaway: 'Pair health checks with alarms to spot unhealthy targets and scaling issues.',
          choices: [
            { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics and alarms' },
            { name: 'AWS CloudTrail', mark: 'CT', hint: 'API activity history' },
            { name: 'AWS Config', mark: 'CFG', hint: 'Resource configuration tracking' },
          ],
        },
      ],
    },
    {
      title: 'Keep the database available',
      context: 'A production app needs a relational database that can fail over to another Availability Zone.',
      prompt: 'Which option provides a managed relational database with Multi-AZ failover?',
      correct: 'Amazon RDS',
      explanation:
        'Amazon Relational Database Service (RDS) runs familiar relational engines for you. With Multi-AZ deployments, RDS maintains a standby in another Availability Zone and can fail over during an outage.',
      takeaway: 'Multi-AZ improves availability; it is not the same thing as a read-scaling replica.',
      flow: [
        { name: 'Web clients', mark: 'WEB' },
        { name: 'Application Load Balancer', mark: 'ALB' },
        { name: 'App tier', mark: 'APP' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
      ],
      choices: [
        { name: 'Amazon RDS', mark: 'RDS', hint: 'Managed SQL database' },
        { name: 'Amazon Redshift', mark: 'RS', hint: 'Analytics warehouse' },
        { name: 'Amazon DocumentDB', mark: 'DOC', hint: 'Document database' },
      ],
      repairs: [
        {
          prompt: 'Where should the application retrieve database credentials?',
          correct: 'AWS Secrets Manager',
          explanation: 'Secrets Manager stores database credentials and can rotate them without embedding secrets in application code.',
          takeaway: 'Keep credentials out of source code and grant workloads only the access they need.',
          choices: [
            { name: 'AWS Secrets Manager', mark: 'SM', hint: 'Secret storage and rotation' },
            { name: 'AWS Systems Manager', mark: 'SSM', hint: 'Operational parameters' },
            { name: 'AWS KMS', mark: 'KMS', hint: 'Encryption keys' },
          ],
        },
        {
          prompt: 'Which service provides metrics and failover alarms?',
          correct: 'Amazon CloudWatch',
          explanation: 'CloudWatch surfaces database metrics and supports alarms for operational signals such as failover events.',
          takeaway: 'Monitoring makes availability behavior visible to the team.',
          choices: [
            { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics and alarms' },
            { name: 'AWS Health', mark: 'HEALTH', hint: 'AWS service events' },
            { name: 'Amazon Inspector', mark: 'INSP', hint: 'Workload vulnerability scans' },
          ],
        },
      ],
    },
  ],
  hard: [
    {
      title: 'Encrypt objects with managed keys',
      context: 'A regulated upload API uses Lambda and stores sensitive files in S3 with centrally managed encryption keys.',
      prompt: 'Which service manages the keys used for server-side encryption?',
      correct: 'AWS Key Management Service',
      explanation:
        'AWS Key Management Service (KMS) creates and controls cryptographic keys. S3 can use a KMS key for server-side encryption, while KMS policies and CloudTrail provide control and auditability.',
      takeaway: 'KMS manages the keys; the service storing your data still performs the encryption integration.',
      flow: [
        { name: 'Upload clients', mark: 'WEB' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Amazon API Gateway', mark: 'API' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'AWS Lambda', mark: 'λ' },
        { name: 'Missing service', mark: '?', missing: true },
      ],
      choices: [
        { name: 'AWS Key Management Service', mark: 'KMS', hint: 'Encryption keys' },
        { name: 'AWS Certificate Manager', mark: 'ACM', hint: 'TLS certificates' },
        { name: 'AWS Secrets Manager', mark: 'SM', hint: 'Application secrets' },
      ],
      repairs: [
        {
          prompt: 'Which service stores the uploaded objects?',
          correct: 'Amazon S3',
          explanation: 'S3 stores uploaded files as durable objects and supports server-side encryption with KMS keys.',
          takeaway: 'Use bucket policies and least-privilege IAM permissions to control access.',
          choices: [
            { name: 'Amazon S3', mark: 'S3', hint: 'Object storage' },
            { name: 'Amazon EBS', mark: 'EBS', hint: 'Block storage for EC2' },
            { name: 'Amazon FSx', mark: 'FSX', hint: 'Managed file systems' },
          ],
        },
        {
          prompt: 'Which service records AWS API activity for audit review?',
          correct: 'AWS CloudTrail',
          explanation: 'CloudTrail records account activity and API calls, including relevant KMS and S3 operations.',
          takeaway: 'Use audit logs to understand who changed or accessed cloud resources.',
          choices: [
            { name: 'AWS CloudTrail', mark: 'CT', hint: 'API activity history' },
            { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics and application logs' },
            { name: 'AWS Config', mark: 'CFG', hint: 'Resource configuration history' },
          ],
        },
        {
          prompt: 'Which service monitors the upload pipeline and raises alarms?',
          correct: 'Amazon CloudWatch',
          explanation: 'CloudWatch collects service metrics and logs and can alert operators when the upload path has problems.',
          takeaway: 'Monitoring complements encryption and audit trails; it answers whether the system is healthy.',
          choices: [
            { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics and alarms' },
            { name: 'AWS Trusted Advisor', mark: 'TA', hint: 'Best-practice checks' },
            { name: 'Amazon EventBridge', mark: 'EB', hint: 'Event routing' },
          ],
        },
      ],
    },
    {
      title: 'Filter hostile web requests',
      context: 'A public web app uses DNS, edge delivery, request filtering, a load balancer, and scalable compute.',
      prompt: 'Which edge service caches and delivers content close to users?',
      correct: 'Amazon CloudFront',
      explanation:
        'Amazon CloudFront is a content delivery network that caches content at edge locations and can be associated with an AWS WAF web ACL.',
      takeaway: 'Use CloudFront for edge delivery and associate WAF rules with the distribution to filter HTTP requests.',
      flow: [
        { name: 'Internet', mark: 'WWW' },
        { name: 'Route 53', mark: 'R53' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Application', mark: 'APP' },
      ],
      choices: [
        { name: 'Amazon CloudFront', mark: 'CF', hint: 'Content delivery network' },
        { name: 'AWS WAF', mark: 'WAF', hint: 'Web request filtering' },
        { name: 'AWS Shield', mark: 'SH', hint: 'DDoS protection' },
      ],
      repairs: [
        {
          prompt: 'Which service filters common web exploits and request patterns?',
          correct: 'AWS WAF',
          explanation: 'AWS WAF lets you define rules that allow, block, or count web requests and can protect a CloudFront distribution.',
          takeaway: 'WAF filters application-layer requests and complements, rather than replaces, network controls.',
          choices: [
            { name: 'AWS WAF', mark: 'WAF', hint: 'Web request filtering' },
            { name: 'AWS Shield', mark: 'SH', hint: 'DDoS protection' },
            { name: 'Amazon GuardDuty', mark: 'GD', hint: 'Threat detection' },
          ],
        },
        {
          prompt: 'Where should filtered requests be routed to the application?',
          correct: 'Application Load Balancer',
          explanation: 'An Application Load Balancer distributes HTTP requests across healthy application targets.',
          takeaway: 'Associate AWS WAF with CloudFront or the ALB, depending on where inspection is needed.',
          choices: [
            { name: 'Application Load Balancer', mark: 'ALB', hint: 'HTTP target routing' },
            { name: 'Network Load Balancer', mark: 'NLB', hint: 'Layer 4 load balancing' },
            { name: 'AWS Transit Gateway', mark: 'TGW', hint: 'VPC connectivity' },
          ],
        },
        {
          prompt: 'Which compute layer serves requests behind the load balancer?',
          correct: 'Amazon EC2 Auto Scaling',
          explanation: 'An EC2 Auto Scaling group supplies application instances and replaces unhealthy capacity.',
          takeaway: 'A load balancer and scalable target fleet improve resilience under changing demand.',
          choices: [
            { name: 'Amazon EC2 Auto Scaling', mark: 'ASG', hint: 'Scalable instance fleet' },
            { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven compute' },
            { name: 'Amazon EKS', mark: 'EKS', hint: 'Managed Kubernetes' },
          ],
        },
      ],
    },
    {
      title: 'Replicate a database across Regions',
      context: 'A globally distributed app needs local reads and multi-Region writes with managed conflict handling.',
      prompt: 'Which DynamoDB capability fits this active-active design?',
      correct: 'DynamoDB Global Tables',
      explanation:
        'DynamoDB Global Tables replicate tables across AWS Regions and support multi-Region, multi-active access. Applications can read and write locally, while DynamoDB handles replication between replicas.',
      takeaway: 'Global Tables are for multi-Region DynamoDB; choose a different pattern when you need SQL semantics.',
      flow: [
        { name: 'App · us-east-1', mark: 'USE1' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'AWS Lambda', mark: 'λ' },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'Missing service', mark: '?', missing: true },
        { name: 'App · eu-west-1', mark: 'EUW1' },
      ],
      choices: [
        { name: 'DynamoDB Global Tables', mark: 'GT', hint: 'Multi-Region NoSQL' },
        { name: 'Aurora Global Database', mark: 'AG', hint: 'Cross-Region SQL' },
        { name: 'S3 Cross-Region Replication', mark: 'CRR', hint: 'Object replication' },
      ],
      repairs: [
        {
          prompt: 'Which database service stores the application records?',
          correct: 'Amazon DynamoDB',
          explanation: 'Global Tables replicate DynamoDB tables, so each Region has a local replica for application reads and writes.',
          takeaway: 'Global Tables are a DynamoDB capability, not a separate database engine.',
          choices: [
            { name: 'Amazon DynamoDB', mark: 'DB', hint: 'Managed NoSQL database' },
            { name: 'Amazon RDS', mark: 'RDS', hint: 'Managed relational database' },
            { name: 'Amazon ElastiCache', mark: 'EC', hint: 'In-memory cache' },
          ],
        },
        {
          prompt: 'Which service directs users to the application endpoint?',
          correct: 'Amazon Route 53',
          explanation: 'Route 53 provides DNS routing for application endpoints and supports health-check-based routing policies.',
          takeaway: 'DNS routing complements data replication; it does not replicate the database.',
          choices: [
            { name: 'Amazon Route 53', mark: 'R53', hint: 'DNS and health checks' },
            { name: 'Amazon CloudFront', mark: 'CF', hint: 'Content delivery network' },
            { name: 'AWS Direct Connect', mark: 'DX', hint: 'Dedicated network link' },
          ],
        },
        {
          prompt: 'Which service monitors the multi-Region workload?',
          correct: 'Amazon CloudWatch',
          explanation: 'CloudWatch provides metrics and alarms to help operators monitor the health of the workload in each Region.',
          takeaway: 'Multi-Region designs also need operational visibility in every participating Region.',
          choices: [
            { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics and alarms' },
            { name: 'AWS CloudTrail', mark: 'CT', hint: 'API activity history' },
            { name: 'AWS Config', mark: 'CFG', hint: 'Resource configuration tracking' },
          ],
        },
      ],
    },
  ],
}

function ServiceLogo({ name, mark, className = '' }: { name: string; mark: string; className?: string }) {
  const service = name.toLowerCase()
  const kind = /shopper|customer|client|user/.test(service) ? 'user'
    : service.includes('lambda') ? 'lambda'
      : service.includes('s3') ? 's3'
        : service.includes('cloudfront') ? 'cloud'
          : /dynamodb|rds|database/.test(service) ? 'database'
            : /cloudwatch|monitor/.test(service) ? 'monitor'
              : /sqs|queue/.test(service) ? 'queue'
                : /sns|notification/.test(service) ? 'notification'
                  : /kinesis|stream/.test(service) ? 'stream'
                    : /route 53|load balancer|transit gateway|api gateway|network/.test(service) ? 'network'
                      : /ecr|container/.test(service) ? 'container'
                        : /kms|secret|waf|shield|guardduty|certificate/.test(service) ? 'security'
                          : /web app|browser/.test(service) ? 'browser'
                            : /ebs|storage/.test(service) ? 'storage'
                              : 'server'

  return (
    <svg className={`service-logo logo-${kind} ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {kind === 'user' && <><circle cx="16" cy="10" r="5" /><path d="M6 27c.7-6 4.1-9 10-9s9.3 3 10 9z" /></>}
      {kind === 'lambda' && <path d="M8 5h8l-1.4 4.1L24 27h-6.2l-6-13.2L8.3 27H2l7-18H7z" />}
      {kind === 's3' && <><path d="M7 8h18l-2 17H9L7 8Z" /><path d="M10 12h12M10.5 16h11M11 20h10" /></>}
      {kind === 'cloud' && <><path d="M9 23h14a5 5 0 0 0 .3-10A8 8 0 0 0 8 14a4.5 4.5 0 0 0 1 9Z" /><path d="M12 18h8m-3-3 3 3-3 3" /></>}
      {kind === 'database' && <><ellipse cx="16" cy="8" rx="10" ry="4" /><path d="M6 8v15c0 2.2 4.5 4 10 4s10-1.8 10-4V8M6 15c0 2.2 4.5 4 10 4s10-1.8 10-4" /></>}
      {kind === 'monitor' && <><rect x="4" y="5" width="24" height="20" rx="3" /><path d="m8 19 5-6 4 3 6-7M12 28h8m-4-3v3" /></>}
      {kind === 'queue' && <><rect x="6" y="6" width="20" height="6" rx="1" /><rect x="6" y="15" width="20" height="6" rx="1" /><path d="M10 9h.1M14 9h8M10 18h.1M14 18h8" /></>}
      {kind === 'notification' && <><path d="M8 22h16l-2-3v-6a6 6 0 0 0-12 0v6l-2 3Z" /><path d="M13 26h6" /></>}
      {kind === 'stream' && <><path d="M4 11c4-6 8 6 12 0s8 6 12 0M4 17c4-6 8 6 12 0s8 6 12 0M4 23c4-6 8 6 12 0s8 6 12 0" /></>}
      {kind === 'network' && <><circle cx="16" cy="7" r="3" /><circle cx="7" cy="24" r="3" /><circle cx="25" cy="24" r="3" /><path d="m14 10-5 11m9-11 5 11M10 24h12" /></>}
      {kind === 'container' && <><path d="m16 4 11 6v12l-11 6-11-6V10l11-6Z" /><path d="m5 10 11 6 11-6M16 16v12m-6-15v4m12-4v4" /></>}
      {kind === 'security' && <><path d="M16 3 26 7v7c0 7-4 12-10 15C10 26 6 21 6 14V7l10-4Z" /><path d="m11 16 3 3 7-8" /></>}
      {kind === 'browser' && <><rect x="4" y="5" width="24" height="21" rx="3" /><path d="M4 11h24M9 8h.1M13 8h.1M16 17h8m-8 4h5" /></>}
      {kind === 'storage' && <><rect x="5" y="5" width="22" height="22" rx="3" /><path d="M10 10h12v12H10zM13 13h6v6h-6z" /></>}
      {kind === 'server' && <><rect x="5" y="5" width="22" height="9" rx="2" /><rect x="5" y="18" width="22" height="9" rx="2" /><path d="M9 9h.1M13 9h9M9 22h.1M13 22h9" /></>}
      {kind !== 'user' && kind !== 'lambda' && kind !== 's3' && kind !== 'cloud' && kind !== 'database' && kind !== 'monitor' && kind !== 'queue' && kind !== 'notification' && kind !== 'stream' && kind !== 'network' && kind !== 'container' && kind !== 'security' && kind !== 'browser' && kind !== 'storage' && kind !== 'server' && <text x="16" y="21" textAnchor="middle">{mark}</text>}
    </svg>
  )
}

function App() {
  const [mode, setMode] = useState<Mode>('easy')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [repaired, setRepaired] = useState<string[]>([])
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [orderedChoices, setOrderedChoices] = useState(() => shuffleChoices(challenges.easy[0].choices))

  const rounds = challenges[mode]
  const challenge = rounds[questionIndex]
  const isComplete = questionIndex >= rounds.length
  const nextMode: Mode | null = mode === 'easy' ? 'medium' : mode === 'medium' ? 'hard' : null
  const repairSteps = challenge ? [
    { prompt: challenge.prompt, correct: challenge.correct, explanation: challenge.explanation, takeaway: challenge.takeaway, choices: challenge.choices },
    ...(challenge.repairs ?? []),
  ] : []
  const justInstalled = submitted && selected !== null && repaired[repaired.length - 1] === selected
  const activeRepairIndex = Math.max(0, repaired.length - (justInstalled ? 1 : 0))
  const activeRepair = repairSteps[activeRepairIndex]
  const isCorrect = selected === activeRepair?.correct
  const selectedService = activeRepair?.choices.find((choice) => choice.name === selected)
  const earnedPoints = modeDetails[mode].points + Math.max(streak - 1, 0) * 25

  function chooseMode(nextMode: Mode) {
    setMode(nextMode)
    setQuestionIndex(0)
    setOrderedChoices(shuffleChoices(challenges[nextMode][0].choices))
    setSelected(null)
    setSubmitted(false)
    setRepaired([])
    setPoints(0)
    setStreak(0)
  }

  function submitAnswer(answer: string | null = selected) {
    if (!answer || !activeRepair || submitted) return
    setSelected(answer)
    setSubmitted(true)
    if (answer === activeRepair.correct) {
      setRepaired((current) => [...current, activeRepair.correct])
      setPoints((current) => current + earnedPoints)
      setStreak((current) => current + 1)
    } else {
      setStreak(0)
    }
  }

  function acceptDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    const droppedService = event.dataTransfer.getData('text/plain')
    if (activeRepair?.choices.some((choice) => choice.name === droppedService)) submitAnswer(droppedService)
  }

  function nextQuestion() {
    const nextIndex = questionIndex + 1
    setQuestionIndex(nextIndex)
    setOrderedChoices(rounds[nextIndex] ? shuffleChoices(rounds[nextIndex].choices) : [])
    setSelected(null)
    setSubmitted(false)
    setRepaired([])
  }

  function replayMode() {
    setQuestionIndex(0)
    setOrderedChoices(shuffleChoices(rounds[0].choices))
    setSelected(null)
    setSubmitted(false)
    setPoints(0)
    setStreak(0)
    setRepaired([])
  }

  function continueAfterSubmit() {
    if (!isCorrect) {
      setSelected(null)
      setSubmitted(false)
      return
    }
    if (repaired.length === repairSteps.length) nextQuestion()
    else {
      setOrderedChoices(shuffleChoices(repairSteps[repaired.length].choices))
      setSelected(null)
      setSubmitted(false)
    }
  }

  return (
    <main className="game-shell" id="top">
      <header className="game-topbar">
        <a className="brand" href="#top" aria-label="Cloudmaster home">
          <span className="brand-mark">C</span><span>CLOUDMASTER</span>
        </a>
        <div className="hud-stats"><span>STREAK <b>{String(streak).padStart(2, '0')}</b></span><span>CORE <b>{String(points).padStart(4, '0')}</b></span></div>
      </header>

      <section className="mission-bar">
        <nav className="difficulty-switch" aria-label="Difficulty level">
          {(Object.keys(modeDetails) as Mode[]).map((key) => (
            <button className={mode === key ? 'active' : ''} key={key} onClick={() => chooseMode(key)} type="button" aria-pressed={mode === key} title={modeDetails[key].label}>
              {modeDetails[key].label}
            </button>
          ))}
        </nav>
      </section>

      {!isComplete && challenge ? <>
        <section className="machine-stage" aria-label="AWS architecture diagram">
          <div className="stage-header"><span>REQUEST FLOW / {mode.toUpperCase()}-{String(questionIndex + 1).padStart(2, '0')}</span><span><i className="stage-led" /> {submitted ? (isCorrect ? (repaired.length === repairSteps.length ? 'ARCHITECTURE COMPLETE' : 'SERVICE CONNECTED') : 'PATH MISMATCH') : 'OPEN CIRCUIT'}</span></div>
          <div className="machine-scene circuit-board">
            <p className="circuit-problem">{challenge.context}</p>
            <div className="board-heading"><span>AWS CLOUD / SERVICE FLOW</span><span>REQUEST PATH <b>→</b></span></div>
            <div className={`architecture-route ${challenge.flow.length <= 3 ? 'route-short' : ''} ${challenge.flow.length === 4 ? 'route-four' : ''} ${challenge.flow.length > 6 ? 'route-long' : ''}`}>
              {challenge.flow.map((step, index) => {
                const missingIndex = challenge.flow.slice(0, index).filter((item) => item.missing).length
                const expectedRepair = repairSteps[missingIndex]
                const installed = step.missing && repaired.includes(expectedRepair?.correct ?? '')
                const service = installed
                  ? repairSteps.find((repair) => repair.correct === expectedRepair?.correct)?.choices.find((choice) => choice.name === expectedRepair?.correct)
                  : undefined
                const column = challenge.flow.length > 6
                  ? index < 4 ? index + 1 : 8 - index
                  : challenge.flow.length === 4
                  ? (index === 0 || index === 3 ? 1 : 2)
                  : index < 3 ? index + 1 : index < 6 ? 6 - index : 1
                const row = challenge.flow.length > 6
                  ? (index < 4 ? 1 : 2)
                  : challenge.flow.length === 4 ? (index < 2 ? 1 : 2) : index < 3 ? 1 : index < 6 ? 2 : 3
                const linkDirection = challenge.flow.length > 6
                  ? (index === 3 ? 'down' : index >= 4 ? 'left' : 'right')
                  : challenge.flow.length === 4
                  ? (index === 1 ? 'down' : index === 2 ? 'left' : 'right')
                  : index === 2 || index === 5 ? 'down' : index >= 3 ? 'left' : 'right'
                const hasService = !step.missing || installed
                const serviceName = installed ? expectedRepair.correct : step.name
                const serviceMark = installed ? service?.mark ?? step.mark : step.mark
                const serviceIcon = hasService && <span className="route-mark"><ServiceLogo name={serviceName} mark={serviceMark} /></span>
                return <div className={`route-node ${step.missing ? 'route-missing' : 'route-service'} ${installed ? 'route-inserted' : ''} ${step.missing && missingIndex === repaired.length ? 'route-active' : ''} ${/shopper|internet|upload/i.test(step.name) ? 'route-external' : ''}`} key={`${step.name}-${index}`} style={{ gridColumn: column, gridRow: row }}>
                  {step.missing ? <button className="route-card" type="button" disabled={installed || submitted || missingIndex !== repaired.length} onClick={() => selected && submitAnswer(selected)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={acceptDrop} aria-label={installed ? `${serviceName} installed` : missingIndex === repaired.length ? 'Active empty service slot. Drop or place the selected service here.' : `Empty service slot ${missingIndex + 1}`}>
                    {serviceIcon}
                  </button> : <div className="route-card">{serviceIcon}</div>}
                  {hasService && <span className="route-name">{serviceName}</span>}
                  <span className="route-kind">{installed ? 'CONNECTED' : step.missing ? 'OPEN SLOT' : 'AWS SERVICE'}</span>
                  {index < challenge.flow.length - 1 && <i className={`route-link route-link-${linkDirection}`} aria-hidden="true" />}
                </div>
              })}
            </div>
          </div>
        </section>

        <section className="build-console">
          <div className="console-heading"><h1>{activeRepair.prompt}</h1><span className="points-tag">+{modeDetails[mode].points} XP</span></div>
          <div className="module-rack" role="group" aria-label="Choose an AWS service">
            {orderedChoices.map((choice, index) => <button
              className={`module-card ${selected === choice.name ? 'selected' : ''} ${submitted && isCorrect && choice.name === activeRepair.correct ? 'revealed-correct' : ''} ${submitted && selected === choice.name && choice.name !== activeRepair.correct ? 'revealed-wrong' : ''}`}
              type="button" key={choice.name} draggable={!submitted} onDragStart={(event) => { event.dataTransfer.setData('text/plain', choice.name); event.dataTransfer.effectAllowed = 'move'; setSelected(choice.name) }} onClick={() => !submitted && setSelected(choice.name)} disabled={submitted} aria-label={`${String.fromCharCode(65 + index)}: ${choice.name}, ${choice.hint}`} aria-pressed={selected === choice.name}>
              <span className="module-number">0{index + 1}</span>
              <span className={`module-art art-${index}`}><i className="module-prong prong-left" /><i className="module-prong prong-right" /><ServiceLogo name={choice.name} mark={choice.mark} className="module-logo" /><i className="module-foot foot-left" /><i className="module-foot foot-right" /></span>
              <span className="module-mark">{choice.mark}</span>
              <span className="module-state">{submitted && selected === choice.name ? (choice.name === activeRepair.correct ? 'LOCKED' : 'REJECT') : selected === choice.name ? 'SELECTED' : 'MODULE'}</span>
            </button>)}
          </div>

          {submitted && selected && <div className={`feedback-panel ${isCorrect ? 'correct' : 'incorrect'}`} role="status">
            <div className="feedback-heading"><span>{isCorrect ? `SERVICE CONNECTED // ${activeRepair.correct}` : 'SERVICE ROLE MISMATCH'}</span>{isCorrect && <strong>+{earnedPoints} XP</strong>}</div>
            {isCorrect ? <><p>{activeRepair.explanation}</p><div className="takeaway"><span>FIELD NOTE</span>{activeRepair.takeaway}</div></> : <p><strong>{selectedService?.name}:</strong> {selectedService?.hint}. This role does not fit the requirement in this step. Recheck the prompt and try another service.</p>}
          </div>}
          <div className="console-footer">
            <span className="build-progress">SCENARIO {Math.min(questionIndex + 1, rounds.length)} / {rounds.length} · {modeDetails[mode].label.toUpperCase()} LEVEL</span>
            {!submitted ? <span className="drop-instruction">{selected ? 'DROP SELECTED SERVICE INTO THE HIGHLIGHTED SLOT' : 'DRAG A SERVICE, OR SELECT IT AND TAP THE SLOT'}</span> : <button className="primary-button" type="button" onClick={continueAfterSubmit}><span>{!isCorrect ? 'TRY AGAIN' : repaired.length < repairSteps.length ? 'NEXT COMPONENT' : questionIndex < rounds.length - 1 ? 'NEXT BLUEPRINT' : 'VIEW RUN REPORT'}</span><b>↗</b></button>}
          </div>
        </section>
      </> : <section className="completion-panel">
        <span className="completion-mark">✓</span><p className="eyebrow">RUN REPORT // {mode.toUpperCase()}</p><h2>All systems operational.</h2>
        <div className="completion-stats"><div><strong>{rounds.length}</strong><span>RECOVERED</span></div><div><strong>{points}</strong><span>CORE XP</span></div><div><strong>{streak}</strong><span>STREAK</span></div></div>
        <div className="completion-actions"><button className="primary-button" type="button" onClick={nextMode ? () => chooseMode(nextMode) : replayMode}><span>{nextMode ? `NEXT LEVEL: ${modeDetails[nextMode].label.toUpperCase()}` : 'REPLAY HARD'}</span><b>{nextMode ? '↗' : '↻'}</b></button></div>
      </section>}
      <footer className="game-footer"><span>CC-09 // CLOUD SYSTEMS RECOVERY</span></footer>
    </main>
  )
}

export default App
