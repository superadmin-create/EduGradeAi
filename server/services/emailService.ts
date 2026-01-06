// Gmail integration for sending submission confirmation emails
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    console.log('Using cached Gmail access token');
    return connectionSettings.settings.access_token;
  }
  
  if (forceRefresh) {
    console.log('Forcing Gmail token refresh...');
    connectionSettings = null;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  console.log('REPLIT_CONNECTORS_HOSTNAME:', hostname ? 'present' : 'missing');
  
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  console.log('Token type:', process.env.REPL_IDENTITY ? 'REPL_IDENTITY' : process.env.WEB_REPL_RENEWAL ? 'WEB_REPL_RENEWAL' : 'none');

  if (!xReplitToken) {
    console.error('No X_REPLIT_TOKEN found - Gmail emails cannot be sent');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  if (!hostname) {
    console.error('REPLIT_CONNECTORS_HOSTNAME not set');
    throw new Error('Gmail connector hostname not configured');
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );
    
    const data = await response.json();
    connectionSettings = data.items?.[0];
    
    if (!connectionSettings) {
      console.error('No Gmail connection found in connector response');
      throw new Error('Gmail not connected - please set up Gmail integration');
    }

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!accessToken) {
      console.error('No access token in Gmail connection settings');
      throw new Error('Gmail access token not available');
    }
    
    console.log('Gmail access token obtained successfully');
    return accessToken;
  } catch (error) {
    console.error('Error fetching Gmail connection:', error);
    throw error;
  }
}

async function getGmailClient(forceRefresh = false) {
  const accessToken = await getAccessToken(forceRefresh);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function createEmailMessage(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ].join('\n');
  
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendSubmissionConfirmationEmail(
  studentEmail: string,
  studentName: string,
  assignmentTitle: string,
  collegeName: string,
  submittedAt: Date
): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    
    const formattedDate = submittedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `Assignment Submission Received - ${assignmentTitle}`;
    
    const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .highlight { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .success-icon { font-size: 48px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">✅</div>
      <h1 style="margin: 0;">Submission Received!</h1>
    </div>
    <div class="content">
      <p>Dear ${studentName},</p>
      
      <p>We have successfully received your submission for the following assignment:</p>
      
      <div class="highlight">
        <strong>Assignment:</strong> ${assignmentTitle}<br>
        <strong>Institution:</strong> ${collegeName}<br>
        <strong>Submitted on:</strong> ${formattedDate}
      </div>
      
      <p>Your assignment is now in our system and will be evaluated by our AI-powered grading system. You will receive your grade once it has been reviewed by your professor.</p>
      
      <p><strong>What happens next?</strong></p>
      <ul>
        <li>Your submission will be processed and graded</li>
        <li>Your professor will review the results</li>
        <li>You may receive additional feedback from your professor</li>
      </ul>
      
      <p>If you have any questions about your submission, please contact your professor or institution administrator.</p>
      
      <p>Best regards,<br>
      <strong>${collegeName} - AI Assignment Grader</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AI Assignment Grader</p>
    </div>
  </div>
</body>
</html>
`;

    const encodedMessage = createEmailMessage(studentEmail, subject, body);
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`Confirmation email sent to ${studentEmail} for assignment: ${assignmentTitle}`);
    return true;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    return false;
  }
}

export async function sendOtpEmail(
  studentEmail: string,
  otp: string,
  collegeName: string
): Promise<boolean> {
  const subject = `Your Verification Code - ${collegeName}`;
  
  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .otp-box { background: #4F46E5; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block; margin: 20px 0; }
    .warning { color: #dc2626; font-size: 14px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Email Verification</h1>
    </div>
    <div class="content" style="text-align: center;">
      <p>You are submitting an assignment at <strong>${collegeName}</strong>.</p>
      <p>Please use the following verification code to proceed:</p>
      
      <div class="otp-box">${otp}</div>
      
      <p>This code will expire in <strong>10 minutes</strong>.</p>
      
      <p class="warning">If you did not request this code, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AI Assignment Grader</p>
    </div>
  </div>
</body>
</html>
`;

  const encodedMessage = createEmailMessage(studentEmail, subject, body);

  async function trySendEmail(forceRefresh: boolean): Promise<void> {
    console.log(`Attempting to send OTP to ${studentEmail}... (forceRefresh: ${forceRefresh})`);
    const gmail = await getGmailClient(forceRefresh);
    console.log('Gmail client obtained successfully');
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
  }

  try {
    await trySendEmail(false);
    console.log(`OTP email sent to ${studentEmail}`);
    return true;
  } catch (error: any) {
    if (error?.status === 401 || error?.code === 401) {
      console.log('Got 401 error, retrying with token refresh...');
      try {
        await trySendEmail(true);
        console.log(`OTP email sent to ${studentEmail} (after token refresh)`);
        return true;
      } catch (retryError) {
        console.error('Failed to send OTP email after token refresh:', retryError);
        return false;
      }
    }
    console.error('Failed to send OTP email:', error);
    return false;
  }
}

export async function isEmailServiceConfigured(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function sendEvaluationEmail(
  studentEmail: string,
  studentName: string,
  assignmentTitle: string,
  collegeName: string,
  grade: string,
  score: number,
  maxScore: number,
  percentage: number,
  feedback: string
): Promise<boolean> {
  const subject = `Your Evaluation Results - ${assignmentTitle} | ${collegeName}`;
  
  const feedbackHtml = feedback.replace(/\n/g, '<br>');
  
  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .grade-box { background: #4F46E5; color: white; font-size: 48px; font-weight: bold; padding: 20px 40px; border-radius: 8px; display: inline-block; margin: 20px 0; }
    .score-details { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
    .score-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .score-row:last-child { border-bottom: none; }
    .feedback-section { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5; }
    .feedback-title { font-weight: bold; color: #4F46E5; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Evaluation Results</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${assignmentTitle}</p>
    </div>
    <div class="content" style="text-align: center;">
      <p>Dear <strong>${studentName}</strong>,</p>
      <p>Your assignment has been evaluated. Here are your results:</p>
      
      <div class="grade-box">${grade}</div>
      
      <div class="score-details" style="text-align: left;">
        <div class="score-row">
          <span><strong>Score:</strong></span>
          <span>${score} / ${maxScore}</span>
        </div>
        <div class="score-row">
          <span><strong>Percentage:</strong></span>
          <span>${percentage}%</span>
        </div>
      </div>
      
      <div class="feedback-section" style="text-align: left;">
        <div class="feedback-title">Feedback</div>
        <div>${feedbackHtml}</div>
      </div>
      
      <p style="text-align: left; margin-top: 20px;">If you have any questions about your evaluation, please contact your professor.</p>
      
      <p style="text-align: left;">Best regards,<br>
      <strong>${collegeName} - AI Assignment Grader</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AI Assignment Grader</p>
    </div>
  </div>
</body>
</html>
`;

  const encodedMessage = createEmailMessage(studentEmail, subject, body);

  async function trySendEmail(forceRefresh: boolean): Promise<void> {
    console.log(`Attempting to send evaluation email to ${studentEmail}... (forceRefresh: ${forceRefresh})`);
    const gmail = await getGmailClient(forceRefresh);
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
  }

  try {
    await trySendEmail(false);
    console.log(`Evaluation email sent to ${studentEmail} for assignment: ${assignmentTitle}`);
    return true;
  } catch (error: any) {
    if (error?.status === 401 || error?.code === 401) {
      console.log('Got 401 error, retrying with token refresh...');
      try {
        await trySendEmail(true);
        console.log(`Evaluation email sent to ${studentEmail} (after token refresh)`);
        return true;
      } catch (retryError) {
        console.error('Failed to send evaluation email after token refresh:', retryError);
        return false;
      }
    }
    console.error('Failed to send evaluation email:', error);
    return false;
  }
}
