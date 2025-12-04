import express, { Request } from 'express';
import cors from 'cors';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand, DeleteObjectCommand, DeleteObjectsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Context, getJob, createJob } from '@osaas/client-core';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Interface for S3 config from client
interface S3Config {
  storageType: 'aws' | 's3-compatible';
  endpoint?: string;
  accessKey: string;
  secretKey: string;
  bucket?: string;
  region?: string;
  oscToken: string;
}

// Store config in memory (initialized from environment variables)
let serverConfig: S3Config = {
  storageType: (process.env.STORAGE_TYPE as 'aws' | 's3-compatible') || 's3-compatible',
  endpoint: process.env.S3_ENDPOINT || '',
  accessKey: process.env.S3_ACCESS_KEY || '',
  secretKey: process.env.S3_SECRET_KEY || '',
  bucket: process.env.S3_BUCKET || 's3://vmaf-files',
  region: process.env.S3_REGION || 'eu-north-1',
  oscToken: process.env.OSC_ACCESS_TOKEN || '',
};

// Helper to get config from server memory
const getConfig = (): S3Config => {
  return serverConfig;
};

// Helper to create S3 client from config
const createS3Client = (config: S3Config) => {
  const clientConfig: any = {
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  };

  if (config.storageType === 's3-compatible') {
    // For S3-compatible storage (MinIO, OCI, etc.), use custom endpoint
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = true;
  }
  // For AWS S3, no endpoint needed - SDK uses region to determine endpoint

  return new S3Client(clientConfig);
};

// GET /api/config - return config with masked secrets
app.get('/api/config', (_req, res) => {
  res.json({
    storageType: serverConfig.storageType,
    endpoint: serverConfig.endpoint,
    region: serverConfig.region,
    bucket: serverConfig.bucket,
    accessKey: serverConfig.accessKey ? '****' : '',
    secretKey: serverConfig.secretKey ? '****' : '',
    oscToken: serverConfig.oscToken ? '****' : '',
  });
});

// POST /api/config - update config in memory
app.post('/api/config', (req, res) => {
  const { storageType, endpoint, region, bucket, accessKey, secretKey, oscToken } = req.body;

  // Update only provided fields (allow partial updates)
  if (storageType !== undefined) {
    serverConfig.storageType = storageType;
    // Clear bucket when switching to s3-compatible, clear endpoint when switching to aws
    if (storageType === 's3-compatible') {
      serverConfig.bucket = undefined;
    } else if (storageType === 'aws') {
      serverConfig.endpoint = undefined;
    }
  }
  if (endpoint !== undefined) serverConfig.endpoint = endpoint;
  if (region !== undefined) serverConfig.region = region;
  if (bucket !== undefined) {
    // Strip s3:// prefix and trailing slashes from bucket name
    let cleanBucket = bucket;
    if (cleanBucket.startsWith('s3://')) {
      cleanBucket = cleanBucket.substring(5);
    }
    cleanBucket = cleanBucket.replace(/\/+$/, '');
    serverConfig.bucket = cleanBucket;
  }
  if (accessKey !== undefined && accessKey !== '****') serverConfig.accessKey = accessKey;
  if (secretKey !== undefined && secretKey !== '****') serverConfig.secretKey = secretKey;
  if (oscToken !== undefined && oscToken !== '****') serverConfig.oscToken = oscToken;

  res.json({ success: true, message: 'Configuration updated' });
});

// Helper to ensure bucket exists (does NOT auto-create, just validates)
const ensureBucketExists = async (s3Client: S3Client, bucket: string) => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
      throw new Error(`Bucket '${bucket}' does not exist. Please create it first.`);
    } else {
      throw error;
    }
  }
};

// Job metadata interface
interface JobMetadata {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  referenceKey: string;
  distortedKey: string;
  referenceName: string;
  distortedName: string;
  resultKey: string;
  bucket: string; // Which bucket this job belongs to
  oscJobName?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  vmafScore?: number; // Primary VMAF score (vmaf_hd mean) for display on collapsed card
  description?: string;
}

// Store job status in memory (in production, use a database)
const jobs = new Map<string, {
  status: 'queued' | 'running' | 'completed' | 'failed';
  referenceKey: string;
  distortedKey: string;
  resultKey: string;
  bucket: string;
  config: S3Config;
  oscJobName?: string;
  error?: string;
  referenceName?: string;
  distortedName?: string;
  createdAt?: string;
  completedAt?: string;
  description?: string;
}>();

// Helper to save job metadata to S3
const saveJobMetadata = async (s3Client: S3Client, bucket: string, metadata: JobMetadata) => {
  const key = `jobs/${metadata.jobId}.json`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(metadata, null, 2),
    ContentType: 'application/json',
  });
  await s3Client.send(command);
};

// Helper to load job metadata from S3
const loadJobMetadata = async (s3Client: S3Client, bucket: string, jobId: string): Promise<JobMetadata | null> => {
  try {
    const key = `jobs/${jobId}.json`;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) return null;
    const bodyString = await response.Body.transformToString();
    const metadata = JSON.parse(bodyString);

    // Add bucket field if missing (for backward compatibility with old metadata)
    if (!metadata.bucket) {
      metadata.bucket = bucket;
    }

    return metadata;
  } catch (error) {
    return null;
  }
};

// Helper to list all job metadata from S3
const listJobMetadata = async (s3Client: S3Client, bucket: string): Promise<JobMetadata[]> => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'jobs/',
    });
    const response = await s3Client.send(command);

    if (!response.Contents) return [];

    const jobs: JobMetadata[] = [];
    for (const obj of response.Contents) {
      if (obj.Key && obj.Key.endsWith('.json')) {
        const jobId = obj.Key.replace('jobs/', '').replace('.json', '');
        const metadata = await loadJobMetadata(s3Client, bucket, jobId);
        if (metadata) jobs.push(metadata);
      }
    }

    // Sort by creation date, newest first
    return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error listing job metadata:', error);
    return [];
  }
};

// Get presigned URL for upload
app.post('/api/upload-url', async (req, res) => {
  try {
    const config = getConfig();
    const s3Client = createS3Client(config);

    const { filename, contentType, folder, bucket } = req.body;
    const targetBucket = bucket || config.bucket!;

    // Ensure bucket exists before generating upload URL
    await ensureBucketExists(s3Client, targetBucket);

    const key = folder ? `${folder}/${filename}` : `${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({ url, key });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// List all buckets
app.get('/api/buckets', async (_req, res) => {
  try {
    const config = getConfig();

    // Return empty list if not configured
    if (!config.accessKey || !config.secretKey) {
      return res.json({ buckets: [] });
    }

    const s3Client = createS3Client(config);

    // For AWS S3 with a configured bucket, return only that bucket
    if (config.storageType === 'aws' && config.bucket) {
      // Verify the bucket exists
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));
        return res.json({ buckets: [config.bucket] });
      } catch (error) {
        console.error(`Configured AWS S3 bucket '${config.bucket}' in region '${config.region || 'us-east-1'}' does not exist or is not accessible:`, error);
        return res.status(400).json({ error: `Configured bucket '${config.bucket}' is not accessible in region '${config.region || 'us-east-1'}'` });
      }
    }

    // For S3-Compatible storage, list all buckets
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    const buckets = response.Buckets?.map(b => b.Name!).filter(Boolean) || [];
    res.json({ buckets });
  } catch (error) {
    console.error('Error listing buckets:', error);
    res.status(500).json({ error: 'Failed to list buckets' });
  }
});

// Create a new bucket
app.post('/api/buckets', async (req, res) => {
  try {
    const config = getConfig();

    // For AWS S3 with a configured bucket, don't allow creating new buckets
    if (config.storageType === 'aws' && config.bucket) {
      return res.status(400).json({ error: 'Cannot create buckets when using AWS S3 with a configured bucket. Please use the configured bucket or update your settings.' });
    }

    const s3Client = createS3Client(config);
    const { bucketName } = req.body;

    if (!bucketName || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(bucketName)) {
      return res.status(400).json({ error: 'Invalid bucket name. Must contain only lowercase letters, numbers, and hyphens.' });
    }

    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));

    // Set CORS configuration for the new bucket to allow direct uploads
    try {
      await s3Client.send(new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }));
    } catch (corsError) {
      console.warn(`Failed to set CORS on bucket ${bucketName}:`, corsError);
      // Don't fail the bucket creation if CORS setup fails
    }

    res.json({ success: true, bucket: bucketName });
  } catch (error: any) {
    console.error('Error creating bucket:', error);
    if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
      return res.status(409).json({ error: 'Bucket already exists' });
    }
    res.status(500).json({ error: 'Failed to create bucket' });
  }
});

// Configure CORS on a bucket
app.post('/api/buckets/:bucketName/cors', async (req, res) => {
  try {
    const config = getConfig();
    const s3Client = createS3Client(config);
    const { bucketName } = req.params;

    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }));

    res.json({ success: true, message: `CORS configured for ${bucketName}` });
  } catch (error) {
    console.error('Error setting CORS:', error);
    res.status(500).json({ error: 'Failed to set CORS configuration' });
  }
});

// List folders and files
app.get('/api/files', async (req, res) => {
  try {
    const config = getConfig();
    const s3Client = createS3Client(config);
    const folder = req.query.folder as string || '';
    const bucket = req.query.bucket as string || config.bucket!;
    const prefix = folder ? `${folder}/` : '';

    // Ensure bucket exists before listing files
    await ensureBucketExists(s3Client, bucket);

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
    });

    const response = await s3Client.send(command);

    // Get folders (common prefixes)
    const folders = response.CommonPrefixes?.map(prefix => ({
      type: 'folder' as const,
      key: prefix.Prefix!,
      name: prefix.Prefix!.replace(folder ? `${folder}/` : '', '').replace('/', ''),
    })) || [];

    // Get files
    const files = response.Contents?.filter(obj => obj.Key !== prefix).map(obj => ({
      type: 'file' as const,
      key: obj.Key!,
      name: obj.Key!.split('/').pop()!,
      size: obj.Size,
      lastModified: obj.LastModified,
    })) || [];

    res.json({ folders, files });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Create a folder
app.post('/api/folders', async (req, res) => {
  try {
    const config = getConfig();
    const s3Client = createS3Client(config);
    const { folderName, parentFolder, bucket } = req.body;
    const targetBucket = bucket || config.bucket!;

    if (!folderName || folderName.includes('/')) {
      return res.status(400).json({ error: 'Invalid folder name' });
    }

    // Ensure bucket exists
    await ensureBucketExists(s3Client, targetBucket);

    // Create folder by creating a .keep file
    const folderPath = parentFolder ? `${parentFolder}/${folderName}` : folderName;
    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: `${folderPath}/.keep`,
      Body: '',
    });

    await s3Client.send(command);

    res.json({ success: true, folder: folderPath });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Delete a file (match any path after /api/files/)
app.delete(/^\/api\/files\/(.+)$/, async (req, res) => {
  try {
    const config = getConfig();
    const s3Client = createS3Client(config);
    const key = decodeURIComponent(req.params[0]);

    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    await s3Client.send(command);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Delete a folder and all its contents (match any path after /api/folders/)
app.delete(/^\/api\/folders\/(.+)$/, async (req, res) => {
  try {
    const config = getConfig();
    const s3Client = createS3Client(config);
    const folder = decodeURIComponent(req.params[0]);

    // List all objects in the folder
    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: `${folder}/`,
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return res.json({ success: true });
    }

    // Delete all objects in the folder
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: listResponse.Contents.map(obj => ({ Key: obj.Key! })),
      },
    });

    await s3Client.send(deleteCommand);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Trigger VMAF analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const config = getConfig();
    const { referenceKey, distortedKey, folder, bucket, description } = req.body;
    const targetBucket = bucket || config.bucket!;

    const jobId = `job${Date.now()}`;
    const createdAt = new Date().toISOString();

    // Store results in folder/results/ if folder is provided
    const resultKey = folder ? `${folder}/results/${jobId}.json` : `results/${jobId}.json`;

    // Extract file names from keys
    const referenceName = referenceKey.split('/').pop() || referenceKey;
    const distortedName = distortedKey.split('/').pop() || distortedKey;

    // Store job info with config
    jobs.set(jobId, {
      status: 'queued',
      referenceKey,
      distortedKey,
      resultKey,
      bucket: targetBucket,
      config,
      referenceName,
      distortedName,
      createdAt,
      description,
    });

    // Build S3 URLs as URL objects
    const referenceUrl = new URL(`s3://${targetBucket}/${referenceKey}`);
    const distortedUrl = new URL(`s3://${targetBucket}/${distortedKey}`);
    const resultBucket = new URL(`s3://${targetBucket}/${folder ? `${folder}/results` : 'results'}`);

    // Update status to running
    jobs.set(jobId, { ...jobs.get(jobId)!, status: 'running' });

    // Initialize OSC Context with token from config
    const oscContext = new Context({
      personalAccessToken: config.oscToken,
    });

    // Get service access token - this will fail with invalid OSC token
    let serviceAccessToken;
    try {
      serviceAccessToken = await oscContext.getServiceAccessToken('eyevinn-easyvmaf-s3');
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Failed to get OSC service access token:', err.message);
      jobs.set(jobId, { ...jobs.get(jobId)!, status: 'failed', error: 'Invalid OSC token or service unavailable' });

      // Save failed job metadata to S3
      try {
        const s3Client = createS3Client(config);
        await saveJobMetadata(s3Client, targetBucket, {
          jobId,
          status: 'failed',
          referenceKey,
          distortedKey,
          referenceName,
          distortedName,
          resultKey,
          bucket: targetBucket,
          createdAt,
          error: 'Invalid OSC token or service unavailable',
          description,
        });
      } catch (saveError) {
        console.error('Failed to save error job metadata:', saveError);
      }

      return res.status(400).json({
        error: 'Failed to authenticate with OSC. Please check your OSC token in settings.',
        jobId,
      });
    }

    // Create OSC job name (alphanumeric only)
    const oscJobName = Math.random().toString(36).substring(7);
    const resultFile = `${resultBucket.href.replace(/\/$/, '')}/${oscJobName}.json`;

    // Create and execute EasyVMAF job
    (async () => {
      try {
        const job = await createJob(
          oscContext,
          'eyevinn-easyvmaf-s3',
          serviceAccessToken,
          {
            name: oscJobName,
            AwsAccessKeyId: config.accessKey,
            AwsSecretAccessKey: config.secretKey,
            S3EndpointUrl: config.endpoint,
            cmdLineArgs: `-r ${referenceUrl.href} -d ${distortedUrl.href} -o ${resultFile}`,
          }
        );

        // Store the OSC job name
        const currentJob = jobs.get(jobId)!;
        jobs.set(jobId, { ...currentJob, oscJobName: job.name });

        // Save job metadata to S3
        const s3Client = createS3Client(config);
        await saveJobMetadata(s3Client, targetBucket, {
          jobId,
          status: currentJob.status,
          referenceKey: currentJob.referenceKey,
          distortedKey: currentJob.distortedKey,
          referenceName: currentJob.referenceName!,
          distortedName: currentJob.distortedName!,
          resultKey: currentJob.resultKey,
          bucket: targetBucket,
          oscJobName: job.name,
          createdAt: currentJob.createdAt!,
          description: currentJob.description,
        });

        // Poll for job completion
        let completed = false;
        while (!completed) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          const oscJob = await getJob(oscContext, 'eyevinn-easyvmaf-s3', job.name, serviceAccessToken);

          // Update job status to running if not yet completed
          if (oscJob.status === 'Running') {
            const runningJob = jobs.get(jobId);
            if (runningJob && runningJob.status === 'queued') {
              jobs.set(jobId, { ...runningJob, status: 'running' });
            }
          }

          // Check for completion statuses
          if (oscJob.status === 'SuccessCriteriaMet' || oscJob.status === 'Completed' || oscJob.status === 'Success') {
            completed = true;
            const completedJob = jobs.get(jobId)!;
            const completedAt = new Date().toISOString();
            jobs.set(jobId, { ...completedJob, status: 'completed', completedAt });

            // Fetch VMAF score for metadata
            let vmafScore: number | undefined;
            try {
              const s3Client = createS3Client(config);
              const folder = completedJob.resultKey.substring(0, completedJob.resultKey.lastIndexOf('/') + 1);
              const resultFileKey = `${folder}${completedJob.oscJobName}.json`;

              const getCommand = new GetObjectCommand({
                Bucket: targetBucket,
                Key: resultFileKey,
              });

              const response = await s3Client.send(getCommand);
              if (response.Body) {
                const bodyString = await response.Body.transformToString();
                const vmafData = JSON.parse(bodyString);

                // Extract primary VMAF score (vmaf_hd mean)
                const pooledMetrics = vmafData.pooled_metrics || {};
                const vmafHd = pooledMetrics.vmaf_hd || pooledMetrics.vmaf;
                vmafScore = vmafHd?.mean;
              }
            } catch (vmafError) {
              console.error('Failed to fetch VMAF score for metadata:', vmafError);
            }

            // Save completed job metadata to S3
            const s3Client = createS3Client(config);
            await saveJobMetadata(s3Client, targetBucket, {
              jobId,
              status: 'completed',
              referenceKey: completedJob.referenceKey,
              distortedKey: completedJob.distortedKey,
              referenceName: completedJob.referenceName!,
              distortedName: completedJob.distortedName!,
              resultKey: completedJob.resultKey,
              bucket: targetBucket,
              oscJobName: completedJob.oscJobName!,
              createdAt: completedJob.createdAt!,
              completedAt,
              vmafScore,
              description: completedJob.description,
            });
          } else if (oscJob.status === 'Failed' || oscJob.status === 'Error') {
            throw new Error(`Job failed with status: ${oscJob.status}`);
          }
        }
      } catch (error: unknown) {
        const err = error as Error;
        const failedJob = jobs.get(jobId)!;
        jobs.set(jobId, { ...failedJob, status: 'failed', error: err.message });
        console.error(`Job ${jobId} failed:`, err.message);
        console.error('Full error:', err);

        // Save failed job metadata to S3
        try {
          const s3Client = createS3Client(config);
          await saveJobMetadata(s3Client, targetBucket, {
            jobId,
            status: 'failed',
            referenceKey: failedJob.referenceKey,
            distortedKey: failedJob.distortedKey,
            referenceName: failedJob.referenceName!,
            distortedName: failedJob.distortedName!,
            resultKey: failedJob.resultKey,
            bucket: targetBucket,
            oscJobName: failedJob.oscJobName,
            createdAt: failedJob.createdAt!,
            error: err.message,
            description: failedJob.description,
          });
        } catch (saveError) {
          console.error('Failed to save error job metadata:', saveError);
        }
      }
    })();

    res.json({
      jobId,
      status: 'queued',
      referenceKey,
      distortedKey,
      resultKey,
    });
  } catch (error) {
    console.error('Error triggering analysis:', error);
    res.status(500).json({ error: 'Failed to trigger analysis' });
  }
});

// Get job status from OSC
app.get('/api/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = jobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // If we have an OSC job name, fetch the actual status from OSC using stored config
    if (job.oscJobName && job.config) {
      const oscContext = new Context({
        personalAccessToken: job.config.oscToken,
      });
      const serviceAccessToken = await oscContext.getServiceAccessToken('eyevinn-easyvmaf-s3');

      const oscJob = await getJob(oscContext, 'eyevinn-easyvmaf-s3', job.oscJobName, serviceAccessToken);

      res.json({
        jobId,
        status: job.status,
        oscJobName: job.oscJobName,
        oscJobStatus: oscJob.status,
        oscJobDetails: oscJob,
      });
    } else {
      res.json({
        jobId,
        status: job.status,
        error: job.error,
      });
    }
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// Get VMAF results
app.get('/api/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const config = getConfig();

    // First check in-memory jobs
    let job = jobs.get(jobId);
    let jobConfig = job?.config;
    let bucket = job?.bucket;
    let resultKey = job?.resultKey;
    let oscJobName = job?.oscJobName;
    let status = job?.status;

    // If not in memory, try to load metadata from S3
    if (!job) {
      try {
        const s3Client = createS3Client(config);
        // Try to get bucket from query param, otherwise use default
        const searchBucket = (req.query.bucket as string) || config.bucket!;
        const metadata = await loadJobMetadata(s3Client, searchBucket, jobId);

        if (!metadata) {
          return res.status(404).json({ error: 'Job not found' });
        }

        // Use the job metadata (including bucket from metadata)
        jobConfig = config;
        bucket = metadata.bucket;
        resultKey = metadata.resultKey;
        oscJobName = metadata.oscJobName;
        status = metadata.status;
      } catch (metadataError) {
        console.error('Error loading job metadata:', metadataError);
        return res.status(404).json({ error: 'Job not found' });
      }
    }

    if (status !== 'completed') {
      return res.json({
        jobId,
        status: status,
        error: job?.error,
      });
    }

    // Fetch VMAF results from S3
    try {
      const s3Client = createS3Client(jobConfig!);

      // The result file is named after the OSC job name, not the local job ID
      // Extract the folder from resultKey (e.g., "results/" or "uploads/results/")
      const folder = resultKey!.substring(0, resultKey!.lastIndexOf('/') + 1);
      const resultFileKey = `${folder}${oscJobName}.json`;

      const command = new GetObjectCommand({
        Bucket: bucket!,
        Key: resultFileKey,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const bodyString = await response.Body.transformToString();

      if (!bodyString) {
        throw new Error('Empty response');
      }

      const vmafData = JSON.parse(bodyString);

      // Find all vmaf_* metrics dynamically
      const pooledMetrics = vmafData.pooled_metrics || {};
      const vmafMetricKeys = Object.keys(pooledMetrics).filter(key => key.startsWith('vmaf_'));

      // Extract all vmaf_* data from pooled_metrics
      const vmafMetrics: Record<string, any> = {};
      vmafMetricKeys.forEach(key => {
        vmafMetrics[key] = pooledMetrics[key];
      });

      // Parse frames - extract frameNum and all vmaf_* metrics
      const frames = vmafData.frames?.map((frame: any) => {
        const frameData: any = { frameNum: frame.frameNum };
        // Add all vmaf_* metrics from this frame
        vmafMetricKeys.forEach(metricKey => {
          if (frame.metrics[metricKey] !== undefined) {
            frameData[metricKey] = frame.metrics[metricKey];
          }
        });
        return frameData;
      }) || [];

      // Use the first vmaf_* metric as the primary score (or vmaf_hd if available)
      const primaryMetric = vmafMetricKeys.includes('vmaf_hd')
        ? 'vmaf_hd'
        : vmafMetricKeys[0];
      const primaryScore = vmafMetrics[primaryMetric]?.mean || 0;

      res.json({
        jobId,
        status: 'completed',
        vmafScore: primaryScore,
        frames,
        vmafMetrics, // All vmaf_* metrics with their statistics
        primaryMetric,
      });
    } catch (s3Error) {
      console.error('Error fetching VMAF results:', s3Error);
      // Return as still running since results aren't available yet
      res.json({
        jobId,
        status: 'running',
        error: 'Results not yet available',
      });
    }
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get raw VMAF results file
app.get('/api/results/:jobId/raw', async (req, res) => {
  try {
    const { jobId } = req.params;
    const config = getConfig();

    // First check in-memory jobs
    const job = jobs.get(jobId);
    let jobConfig = job?.config;
    let bucket = job?.bucket;
    let resultKey = job?.resultKey;
    let oscJobName = job?.oscJobName;
    let status = job?.status;

    // If not in memory, try to load metadata from S3
    if (!job) {
      try {
        const s3Client = createS3Client(config);
        // Try to get bucket from query param, otherwise use default
        const searchBucket = (req.query.bucket as string) || config.bucket!;
        const metadata = await loadJobMetadata(s3Client, searchBucket, jobId);

        if (!metadata) {
          return res.status(404).json({ error: 'Job not found' });
        }

        // Use the job metadata
        jobConfig = config;
        bucket = metadata.bucket;
        resultKey = metadata.resultKey;
        oscJobName = metadata.oscJobName;
        status = metadata.status;
      } catch (metadataError) {
        console.error('Error loading job metadata:', metadataError);
        return res.status(404).json({ error: 'Job not found' });
      }
    }

    if (status !== 'completed') {
      return res.status(400).json({ error: 'Job not completed' });
    }

    // Fetch raw VMAF results from S3 using stored config
    const s3Client = createS3Client(jobConfig!);

    // The result file is named after the OSC job name
    const folder = resultKey!.substring(0, resultKey!.lastIndexOf('/') + 1);
    const resultFileKey = `${folder}${oscJobName}.json`;

    const command = new GetObjectCommand({
      Bucket: bucket!,
      Key: resultFileKey,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Stream the raw file directly to the client
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="vmaf-${oscJobName}.json"`);

    const bodyString = await response.Body.transformToString();
    res.send(bodyString);
  } catch (error) {
    console.error('Error fetching raw results:', error);
    res.status(500).json({ error: 'Failed to fetch raw results' });
  }
});

// List all analysis jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const config = getConfig();

    // Return empty list if not configured
    const isConfigured = config.storageType === 'aws'
      ? !!(config.bucket && config.region && config.accessKey && config.secretKey)
      : !!(config.endpoint && config.accessKey && config.secretKey);

    if (!isConfigured) {
      return res.json([]);
    }

    const bucket = req.query.bucket as string || config.bucket!;
    const s3Client = createS3Client(config);

    // Load all job metadata from S3
    const jobList = await listJobMetadata(s3Client, bucket);

    res.json(jobList);
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Delete a job and its associated files
app.delete('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const config = getConfig();
    const s3Client = createS3Client(config);

    // Try to get bucket from in-memory job first, or from query param, or use default
    let targetBucket: string;
    const inMemoryJob = jobs.get(jobId);

    if (inMemoryJob?.bucket) {
      targetBucket = inMemoryJob.bucket;
    } else if (req.query.bucket) {
      targetBucket = req.query.bucket as string;
    } else {
      targetBucket = config.bucket!;
    }

    // First, try to get the job metadata to find the result file
    let metadata: JobMetadata | null = null;
    try {
      metadata = await loadJobMetadata(s3Client, targetBucket, jobId);
      // If we found metadata and it has a bucket, use that instead
      if (metadata?.bucket) {
        targetBucket = metadata.bucket;
      }
    } catch (error) {
      // Metadata not found - will only remove from memory
    }

    // Delete result file if it exists
    if (metadata && metadata.oscJobName && metadata.resultKey) {
      try {
        const folder = metadata.resultKey.substring(0, metadata.resultKey.lastIndexOf('/') + 1);
        const resultFileKey = `${folder}${metadata.oscJobName}.json`;

        await s3Client.send(new DeleteObjectCommand({
          Bucket: targetBucket,
          Key: resultFileKey,
        }));
      } catch (error) {
        console.error('Error deleting result file:', error);
        // Continue even if result file deletion fails
      }
    }

    // Delete job metadata file
    const metadataKey = `jobs/${jobId}.json`;
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: metadataKey,
      }));
    } catch (error) {
      console.error('Error deleting job metadata:', error);
      // Continue even if metadata deletion fails
    }

    // Remove from in-memory jobs map
    jobs.delete(jobId);

    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
