// Gmail integration for sending submission confirmation emails
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();

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
  try {
    const gmail = await getGmailClient();

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
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`OTP email sent to ${studentEmail}`);
    return true;
  } catch (error) {
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
