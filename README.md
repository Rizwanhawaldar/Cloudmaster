# React + TypeScript + Vite

# Cloudmaster

Cloudmaster is an architecture-recovery game for AWS system design. Follow the service flow across an AWS-style architecture diagram and drag service choices into the highlighted slot. On touch devices, select a service and tap the slot. Submitted answers reveal an explanation and a field note. Correct answers earn points, with a bonus for consecutive correct picks.

## Levels

- **Easy:** AWS fundamentals such as S3, DynamoDB, and CloudWatch.
- **Medium:** Six-node architecture patterns with three missing services per scenario.
- **Hard:** Seven-node practitioner architectures with four missing services per scenario.

Easy scenarios each ask for one missing service. Medium and Hard scenarios guide players through restoring each missing service in sequence.

Service options are shuffled for each question and repair step. Completing Easy or Medium offers the next level by name; completing Hard offers a Hard replay.

Each level currently contains three scenarios. Switching levels starts a fresh score for that run.

## AI scenarios

Fresh scenarios are generated locally in the browser with WebLLM and a small Qwen model. No API key or cloud function is needed. The first generation downloads the model and may take a while; subsequent runs use the browser cache. A current WebGPU-capable browser and compatible graphics hardware are required. Recent scenario titles and prompts are saved locally to reduce repeats.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

## Verify

```powershell
npm.cmd run build
npm.cmd run lint
```
