import { useState, type DragEvent } from 'react'
import type { MLCEngineInterface } from '@mlc-ai/web-llm'
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

const seenQuestionsStorageKey = 'cloudmaster-seen-ai-questions-v1'
const localModelId = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
let localAiEngine: MLCEngineInterface | null = null
let localAiEnginePromise: Promise<MLCEngineInterface> | null = null

function questionIdentity(challenge: Pick<Challenge, 'title' | 'prompt'>) {
  return `${challenge.title} ${challenge.prompt}`.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isChallenge(value: unknown): value is Challenge {
  if (typeof value !== 'object' || value === null) return false
  const challenge = value as Partial<Challenge>
  return typeof challenge.title === 'string'
    && typeof challenge.context === 'string'
    && typeof challenge.prompt === 'string'
    && typeof challenge.correct === 'string'
    && typeof challenge.explanation === 'string'
    && typeof challenge.takeaway === 'string'
    && Array.isArray(challenge.flow)
    && Array.isArray(challenge.choices)
    && challenge.choices.length === 3
    && Array.isArray(challenge.repairs)
}

function isValidGeneratedChallenge(value: unknown, mode: Mode): value is Challenge {
  if (!isChallenge(value)) return false
  const config = { easy: { flow: 3, missing: 1 }, medium: { flow: 6, missing: 3 }, hard: { flow: 7, missing: 4 } }[mode]
  if (!Array.isArray(value.flow) || value.flow.length !== config.flow
    || value.flow.filter((node) => node?.missing === true).length !== config.missing
    || !Array.isArray(value.repairs) || value.repairs.length !== config.missing - 1) return false

  const steps = [value, ...value.repairs]
  const answers = steps.map((step) => step.correct)
  const validStep = (step: typeof value) => typeof step.prompt === 'string' && step.prompt.length > 0
    && typeof step.correct === 'string' && step.correct.length > 0
    && typeof step.explanation === 'string' && step.explanation.length > 0
    && typeof step.takeaway === 'string' && step.takeaway.length > 0
    && Array.isArray(step.choices) && step.choices.length === 3
    && step.choices.every((choice) => typeof choice.name === 'string' && choice.name.length > 0
      && typeof choice.mark === 'string' && choice.mark.length > 0
      && typeof choice.hint === 'string' && choice.hint.length > 0)
    && new Set(step.choices.map((choice) => choice.name)).size === 3
    && step.choices.filter((choice) => choice.name === step.correct).length === 1

  return typeof value.title === 'string' && value.title.length > 0
    && typeof value.context === 'string' && value.context.length > 0
    && value.flow.every((node) => typeof node.name === 'string' && node.name.length > 0
      && typeof node.mark === 'string' && node.mark.length > 0)
    && steps.every((step) => validStep(step as typeof value))
    && new Set(answers).size === answers.length
}

async function getLocalAiEngine(onProgress: (progress: string) => void) {
  if (!('gpu' in navigator)) throw new Error('This browser does not support WebGPU. Try a current version of Chrome or Edge with hardware acceleration enabled.')
  if (localAiEngine) return localAiEngine
  if (!localAiEnginePromise) {
    localAiEnginePromise = import('@mlc-ai/web-llm').then(({ CreateWebWorkerMLCEngine }) => {
      const worker = new Worker(new URL('./ai-question.worker.ts', import.meta.url), { type: 'module' })
      return CreateWebWorkerMLCEngine(worker, localModelId, {
        initProgressCallback: (progress) => onProgress(progress.text),
      })
    }).then((engine) => {
      localAiEngine = engine
      return engine
    }).catch((error: unknown) => {
      localAiEnginePromise = null
      throw error
    })
  }
  return localAiEnginePromise
}

function getSeenQuestions(mode: Mode): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(seenQuestionsStorageKey) ?? '{}') as Partial<Record<Mode, string[]>>
    return Array.isArray(saved[mode]) ? saved[mode].filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function rememberQuestion(mode: Mode, identity: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(seenQuestionsStorageKey) ?? '{}') as Partial<Record<Mode, string[]>>
    const current = Array.isArray(saved[mode]) ? saved[mode] : []
    localStorage.setItem(seenQuestionsStorageKey, JSON.stringify({ ...saved, [mode]: [...current, identity].slice(-40) }))
  } catch {}
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

type ScenarioStep = NonNullable<Challenge['repairs']>[number]

function scenarioStep(prompt: string, correct: Service, explanation: string, takeaway: string, alternatives: [Service, Service]): ScenarioStep {
  return { prompt, correct: correct.name, explanation, takeaway, choices: [correct, ...alternatives] }
}

const offlineScenarios: Record<Mode, Challenge[]> = {
  easy: [
    {
      title: 'Audit account activity',
      context: 'A security team needs a searchable record of who changed resources in its AWS account.',
      ...scenarioStep('Which service records account API activity for audits?', { name: 'AWS CloudTrail', mark: 'CT', hint: 'Account API activity history' }, 'CloudTrail records AWS account activity, including who made API calls and which resources they affected.', 'Use CloudTrail when you need to answer who changed a resource and when.', [{ name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics and application logs' }, { name: 'AWS Config', mark: 'CFG', hint: 'Resource configuration history' }]),
      flow: [{ name: 'Administrators', mark: 'IAM' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'AWS account', mark: 'AWS' }],
      repairs: [],
    },
    {
      title: 'Route customers to an app',
      context: 'A web app needs managed DNS so customers can reach its public endpoint.',
      ...scenarioStep('Which service translates the app domain into a routable endpoint?', { name: 'Amazon Route 53', mark: 'R53', hint: 'DNS and health-check routing' }, 'Route 53 is AWS managed DNS and can route requests to healthy application endpoints.', 'DNS finds the endpoint; it does not distribute HTTP requests across instances.', [{ name: 'Amazon CloudFront', mark: 'CF', hint: 'Edge content delivery' }, { name: 'AWS Direct Connect', mark: 'DX', hint: 'Dedicated network connection' }]),
      flow: [{ name: 'Web browsers', mark: 'WEB' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Application endpoint', mark: 'APP' }],
      repairs: [],
    },
    {
      title: 'Run code on demand',
      context: 'A small backend task should run when an event arrives, without managing servers.',
      ...scenarioStep('Which compute service runs code in response to events without server management?', { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven serverless compute' }, 'Lambda runs functions in response to events and manages the underlying compute infrastructure.', 'Use Lambda for short event-driven work when provisioning a server fleet is unnecessary.', [{ name: 'Amazon EC2', mark: 'EC2', hint: 'Virtual machine instances' }, { name: 'Amazon ECS', mark: 'ECS', hint: 'Container orchestration' }]),
      flow: [{ name: 'Application event', mark: 'EVT' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Task result', mark: 'OUT' }],
      repairs: [],
    },
  ],
  medium: [
    {
      title: 'Fan out payment events',
      context: 'A payment service must notify several independent consumers without waiting for them.',
      ...scenarioStep('Which service distributes one event to multiple subscribers?', { name: 'Amazon SNS', mark: 'SNS', hint: 'Pub/sub message fanout' }, 'SNS publishes a message to multiple subscribers, allowing independent consumers to react to the same event.', 'Use pub/sub fanout when one event needs to reach several systems.', [{ name: 'Amazon SQS', mark: 'SQS', hint: 'Point-to-point message queue' }, { name: 'Amazon Kinesis', mark: 'KIN', hint: 'Ordered data streams' }]),
      flow: [{ name: 'Payment API', mark: 'API' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Email and fraud consumers', mark: 'APP' }, { name: 'Order records', mark: 'DB' }],
      repairs: [
        scenarioStep('How should each consumer receive messages durably?', { name: 'Amazon SQS', mark: 'SQS', hint: 'Durable message queue' }, 'An SQS queue buffers messages for a consumer and lets it process them independently.', 'Give each independent consumer its own queue subscription.', [{ name: 'Amazon SNS', mark: 'SNS', hint: 'Pub/sub message fanout' }, { name: 'Amazon EventBridge', mark: 'EB', hint: 'Event routing bus' }]),
        scenarioStep('Which service can run fraud checks when a message arrives?', { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven serverless compute' }, 'Lambda can process messages from an SQS queue without an always-on worker fleet.', 'Connect an event source to the compute that handles each message.', [{ name: 'Amazon EC2', mark: 'EC2', hint: 'Virtual machine instances' }, { name: 'AWS Batch', mark: 'BATCH', hint: 'Batch job scheduling' }]),
      ],
    },
    {
      title: 'Analyze a live clickstream',
      context: 'A product team needs to ingest ordered click events, process them, and retain raw records.',
      ...scenarioStep('Which service ingests ordered streaming events at scale?', { name: 'Amazon Kinesis Data Streams', mark: 'KIN', hint: 'Real-time event streams' }, 'Kinesis Data Streams captures ordered records for multiple consumers to process in near real time.', 'Use a stream when consumers need ordered event records, not independent work items.', [{ name: 'Amazon SQS', mark: 'SQS', hint: 'Point-to-point work queue' }, { name: 'Amazon SNS', mark: 'SNS', hint: 'Pub/sub notifications' }]),
      flow: [{ name: 'Web clients', mark: 'WEB' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Analytics consumers', mark: 'APP' }, { name: 'Raw event archive', mark: 'S3' }],
      repairs: [
        scenarioStep('Which service can transform each incoming event?', { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven stream processing' }, 'Lambda can process records from a Kinesis stream as they arrive.', 'Use event-driven compute to transform records before they reach analytics consumers.', [{ name: 'Amazon ECS', mark: 'ECS', hint: 'Container orchestration' }, { name: 'Amazon EC2', mark: 'EC2', hint: 'Virtual machine instances' }]),
        scenarioStep('Where should the system retain low-cost raw event files?', { name: 'Amazon S3', mark: 'S3', hint: 'Durable object storage' }, 'S3 stores durable objects and is a common destination for raw data archives.', 'Use object storage for durable files and data lake content.', [{ name: 'Amazon EBS', mark: 'EBS', hint: 'Block storage for EC2' }, { name: 'Amazon EFS', mark: 'EFS', hint: 'Shared file system' }]),
      ],
    },
    {
      title: 'Deliver application notifications',
      context: 'A backend emits status updates that should reach several downstream services.',
      ...scenarioStep('Which service broadcasts application events to multiple subscribers?', { name: 'Amazon SNS', mark: 'SNS', hint: 'Managed pub/sub messaging' }, 'SNS sends a published message to each subscribed endpoint.', 'Choose a topic when several consumers need the same event.', [{ name: 'Amazon SQS', mark: 'SQS', hint: 'Durable message queue' }, { name: 'Amazon MQ', mark: 'MQ', hint: 'Managed message broker' }]),
      flow: [{ name: 'Order service', mark: 'APP' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Notifications', mark: 'MSG' }, { name: 'Order database', mark: 'DB' }],
      repairs: [
        scenarioStep('How can each consumer buffer messages until it is ready?', { name: 'Amazon SQS', mark: 'SQS', hint: 'Durable message queue' }, 'SQS stores messages until a consumer is ready to process them.', 'Use one queue per consumer to isolate processing and retries.', [{ name: 'Amazon SNS', mark: 'SNS', hint: 'Pub/sub messaging' }, { name: 'Amazon Kinesis', mark: 'KIN', hint: 'Ordered data stream' }]),
        scenarioStep('Which service runs lightweight notification handlers?', { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven compute' }, 'Lambda can run handlers in response to queue messages and other AWS events.', 'Event-triggered functions avoid keeping idle servers running.', [{ name: 'Amazon EKS', mark: 'EKS', hint: 'Managed Kubernetes' }, { name: 'Amazon EC2', mark: 'EC2', hint: 'Virtual machine instances' }]),
      ],
    },
  ],
  hard: [
    {
      title: 'Process confidential uploads',
      context: 'A document pipeline needs encrypted object storage, event processing, and operational monitoring.',
      ...scenarioStep('Which service stores uploaded documents as durable objects?', { name: 'Amazon S3', mark: 'S3', hint: 'Durable object storage' }, 'S3 stores uploaded documents as objects and supports encryption at rest.', 'Store durable files in object storage, then grant the processing role only the required access.', [{ name: 'Amazon EBS', mark: 'EBS', hint: 'Block storage for EC2' }, { name: 'Amazon EFS', mark: 'EFS', hint: 'Shared file system' }]),
      flow: [{ name: 'Upload clients', mark: 'WEB' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Document processor', mark: 'APP' }, { name: 'Operations', mark: 'OPS' }],
      repairs: [
        scenarioStep('Which service manages encryption keys for stored objects?', { name: 'AWS Key Management Service', mark: 'KMS', hint: 'Encryption key management' }, 'KMS manages the cryptographic keys used by S3 server-side encryption.', 'Separate key management from the service that stores the encrypted objects.', [{ name: 'AWS Certificate Manager', mark: 'ACM', hint: 'TLS certificates' }, { name: 'AWS Secrets Manager', mark: 'SM', hint: 'Application secrets' }]),
        scenarioStep('Which service can process each new object without a server fleet?', { name: 'AWS Lambda', mark: 'λ', hint: 'Event-driven serverless compute' }, 'S3 events can invoke Lambda to process newly uploaded objects.', 'Use an event trigger to start short-lived processing when an object arrives.', [{ name: 'Amazon EC2', mark: 'EC2', hint: 'Virtual machine instances' }, { name: 'Amazon ECS', mark: 'ECS', hint: 'Container orchestration' }]),
        scenarioStep('Which service collects processing metrics and raises alarms?', { name: 'Amazon CloudWatch', mark: 'CW', hint: 'Metrics, logs, and alarms' }, 'CloudWatch collects Lambda metrics and logs and can alert operators on failures.', 'Pair event processing with alarms so failed work is visible.', [{ name: 'AWS CloudTrail', mark: 'CT', hint: 'Account API activity history' }, { name: 'AWS Config', mark: 'CFG', hint: 'Resource configuration history' }]),
      ],
    },
    {
      title: 'Trace a container release',
      context: 'A release pipeline builds a container, stores its image, runs it behind HTTP routing, and manages runtime credentials.',
      ...scenarioStep('Which service stores and versions the built container image?', { name: 'Amazon ECR', mark: 'ECR', hint: 'Managed container image registry' }, 'ECR stores container images and integrates with AWS deployment services.', 'Keep built images in a managed registry that your runtime can pull from.', [{ name: 'Amazon S3', mark: 'S3', hint: 'Object storage' }, { name: 'Amazon EFS', mark: 'EFS', hint: 'Shared file system' }]),
      flow: [{ name: 'Build pipeline', mark: 'CI' }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Missing service', mark: '?', missing: true }, { name: 'Container service', mark: 'APP' }, { name: 'Credential store', mark: 'SEC' }],
      repairs: [
        scenarioStep('Which service schedules and operates the container workload?', { name: 'Amazon ECS', mark: 'ECS', hint: 'Managed container orchestration' }, 'ECS schedules containers and integrates with load balancers and image registries.', 'Use a container orchestrator to manage deployment and task placement.', [{ name: 'Amazon EC2', mark: 'EC2', hint: 'Virtual machine instances' }, { name: 'AWS Batch', mark: 'BATCH', hint: 'Batch job scheduling' }]),
        scenarioStep('Which service routes HTTP requests to healthy tasks?', { name: 'Application Load Balancer', mark: 'ALB', hint: 'Layer 7 HTTP routing' }, 'An ALB distributes HTTP requests across healthy targets and supports path-based routing.', 'Use a layer 7 load balancer for HTTP routing and health checks.', [{ name: 'Network Load Balancer', mark: 'NLB', hint: 'Layer 4 network routing' }, { name: 'Amazon Route 53', mark: 'R53', hint: 'DNS routing' }]),
        scenarioStep('Where should the service retrieve database credentials?', { name: 'AWS Secrets Manager', mark: 'SM', hint: 'Secret storage and rotation' }, 'Secrets Manager stores credentials and can rotate them without embedding them in the image.', 'Keep credentials out of container images and source code.', [{ name: 'AWS KMS', mark: 'KMS', hint: 'Encryption key management' }, { name: 'AWS Systems Manager', mark: 'SSM', hint: 'Operational parameters' }]),
      ],
    },
  ],
}

function getOfflineScenario(mode: Mode, seen: Set<string>) {
  return offlineScenarios[mode].find((scenario) => !seen.has(questionIdentity(scenario)))
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
  const [generatedChallenges, setGeneratedChallenges] = useState<Record<Mode, Challenge[]>>({ easy: [], medium: [], hard: [] })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [generationNotice, setGenerationNotice] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  const rounds = [...challenges[mode], ...generatedChallenges[mode]]
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
    setGenerationNotice(null)
  }

  async function generateQuestion() {
    if (isGenerating) return
    setIsGenerating(true)
    setGenerationNotice(null)
    setGenerationError(null)
    try {
      const seen = new Set([
        ...getSeenQuestions(mode),
        ...rounds.map(questionIdentity),
      ])
      setGenerationProgress('Starting local AI…')
      let payload: Challenge
      try {
        const engine = await getLocalAiEngine(setGenerationProgress)
        const response = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: 'You create technically accurate, original AWS architecture training scenarios. Respond only with a single valid JSON object. Do not repeat excluded topics or wording.' },
            { role: 'user', content: `Create a new ${mode} AWS architecture challenge with a fresh topic. It must have a concise title, context, main prompt, correct answer, explanation, takeaway, flow, three distinct choices, and repairs. Easy: 3 flow nodes and 1 missing service with no repairs. Medium: 6 flow nodes, 3 missing services, and 2 repair steps. Hard: 7 flow nodes, 4 missing services, and 3 repair steps. Each question step has exactly three distinct choices, and its correct field must match exactly one choice name. Do not reuse any correct service across a scenario. Use flow items {"name":"Missing service","mark":"?","missing":true} for missing nodes, and {"name":"AWS service or actor","mark":"short label"} for other nodes. Each step must include prompt, correct, explanation, takeaway, choices; each choice must include name, mark, hint. Return JSON matching those fields exactly. Avoid repeats of these recent scenarios: ${JSON.stringify([...seen].slice(-8))}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.8,
          max_tokens: 2200,
        })
        const content = response.choices[0]?.message.content
        if (typeof content !== 'string') throw new Error('The AI returned an invalid scenario.')
        const aiPayload: unknown = JSON.parse(content)
        if (!isValidGeneratedChallenge(aiPayload, mode)) throw new Error('The AI returned an invalid scenario.')
        if (seen.has(questionIdentity(aiPayload))) throw new Error('The AI returned a repeated scenario.')
        payload = aiPayload
      } catch (error) {
        const offlineScenario = getOfflineScenario(mode, seen)
        if (!offlineScenario) throw error
        payload = offlineScenario
        setGenerationNotice('The local model could not load, so this is an offline scenario, not an AI-generated one.')
      }
      const identity = questionIdentity(payload)
      if (seen.has(identity)) throw new Error('This scenario was already used. Please try generating another.')

      const nextChallenges = [...generatedChallenges[mode], payload]
      setGeneratedChallenges((current) => ({ ...current, [mode]: nextChallenges }))
      rememberQuestion(mode, identity)
      setQuestionIndex(rounds.length)
      setOrderedChoices(shuffleChoices(payload.choices))
      setSelected(null)
      setSubmitted(false)
      setRepaired([])
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Could not generate a question. Please try again.')
    } finally {
      setIsGenerating(false)
      setGenerationProgress('')
    }
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
    setGenerationNotice(null)
  }

  function replayMode() {
    setQuestionIndex(0)
    setOrderedChoices(shuffleChoices(rounds[0].choices))
    setSelected(null)
    setSubmitted(false)
    setPoints(0)
    setStreak(0)
    setRepaired([])
    setGenerationNotice(null)
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
                const previewChoice = step.missing && !installed && !submitted && missingIndex === repaired.length ? selectedService : undefined
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
                const hasService = !step.missing || installed || Boolean(previewChoice)
                const serviceName = installed ? expectedRepair.correct : previewChoice?.name ?? step.name
                const serviceMark = installed ? service?.mark ?? step.mark : previewChoice?.mark ?? step.mark
                const serviceIcon = hasService && <span className="route-mark"><ServiceLogo name={serviceName} mark={serviceMark} /></span>
                return <div className={`route-node ${step.missing ? 'route-missing' : 'route-service'} ${installed ? 'route-inserted' : ''} ${step.missing && missingIndex === repaired.length ? 'route-active' : ''} ${/shopper|internet|upload/i.test(step.name) ? 'route-external' : ''}`} key={`${step.name}-${index}`} style={{ gridColumn: column, gridRow: row }}>
                  {step.missing ? <button className={`route-card ${previewChoice ? 'route-ready' : ''}`} type="button" disabled={installed || submitted || missingIndex !== repaired.length} onClick={() => selected && submitAnswer(selected)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={acceptDrop} aria-label={installed ? `${serviceName} installed` : missingIndex === repaired.length ? selected ? `Place ${selected} in this slot` : 'Select a service, then tap this slot' : `Empty service slot ${missingIndex + 1}`}>
                    {serviceIcon}
                  </button> : <div className="route-card">{serviceIcon}</div>}
                  {hasService && <span className="route-name">{serviceName}</span>}
                  <span className="route-kind">{installed ? 'CONNECTED' : step.missing ? previewChoice ? 'TAP TO PLACE' : 'OPEN SLOT' : 'AWS SERVICE'}</span>
                  {index < challenge.flow.length - 1 && <i className={`route-link route-link-${linkDirection}`} aria-hidden="true" />}
                </div>
              })}
            </div>
          </div>
        </section>

        <section className="build-console">
          <div className="console-heading"><h1>{activeRepair.prompt}</h1><span className="points-tag">+{modeDetails[mode].points} XP</span></div>
          {generationNotice && <p className="generation-notice" role="status">{generationNotice}</p>}
          <div className="module-rack" role="group" aria-label="Choose an AWS service">
            {orderedChoices.map((choice, index) => <button
              className={`module-card ${selected === choice.name ? 'selected' : ''} ${submitted && isCorrect && choice.name === activeRepair.correct ? 'revealed-correct' : ''} ${submitted && selected === choice.name && choice.name !== activeRepair.correct ? 'revealed-wrong' : ''}`}
              type="button" key={choice.name} draggable={!submitted && !isTouchDevice} onDragStart={(event) => { event.dataTransfer.setData('text/plain', choice.name); event.dataTransfer.effectAllowed = 'move'; setSelected(choice.name) }} onClick={() => !submitted && setSelected(choice.name)} disabled={submitted} aria-label={`${String.fromCharCode(65 + index)}: ${choice.name}, ${choice.hint}`} aria-pressed={selected === choice.name}>
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
            {!submitted ? <span className="drop-instruction">{selected ? 'SERVICE SELECTED · TAP THE HIGHLIGHTED SLOT TO PLACE IT' : 'SELECT A SERVICE, THEN TAP THE HIGHLIGHTED SLOT'}</span> : <button className="primary-button" type="button" onClick={continueAfterSubmit}><span>{!isCorrect ? 'TRY AGAIN' : repaired.length < repairSteps.length ? 'NEXT COMPONENT' : questionIndex < rounds.length - 1 ? 'NEXT BLUEPRINT' : 'VIEW RUN REPORT'}</span><b>↗</b></button>}
          </div>
        </section>
      </> : <section className="completion-panel">
        <span className="completion-mark">✓</span><p className="eyebrow">RUN REPORT // {mode.toUpperCase()}</p><h2>All systems operational.</h2>
        <div className="completion-stats"><div><strong>{rounds.length}</strong><span>RECOVERED</span></div><div><strong>{points}</strong><span>CORE XP</span></div><div><strong>{streak}</strong><span>STREAK</span></div></div>
        {generationProgress && <p className="generation-progress" role="status">{generationProgress}</p>}
        {generationError && <p className="generation-error" role="alert">{generationError}</p>}
        <div className="completion-actions">
          <button className="text-button generate-button" type="button" onClick={generateQuestion} disabled={isGenerating}><span>{isGenerating ? 'GENERATING LOCALLY...' : 'GENERATE NEW SCENARIO'}</span><b>✦</b></button>
          <button className="primary-button" type="button" onClick={nextMode ? () => chooseMode(nextMode) : replayMode}><span>{nextMode ? `NEXT LEVEL: ${modeDetails[nextMode].label.toUpperCase()}` : 'REPLAY HARD'}</span><b>{nextMode ? '↗' : '↻'}</b></button>
        </div>
      </section>}
      <footer className="game-footer"><span>CC-09 // CLOUD SYSTEMS RECOVERY</span></footer>
    </main>
  )
}

export default App
