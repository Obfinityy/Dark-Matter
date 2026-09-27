import crypto from 'node:crypto';

const algorithm = 'aes-256-gcm';

export class SecretBox {
  constructor(secret) {
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(payload) {
    const [ivText, tagText, encryptedText] = String(payload).split('.');
    if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted secret');
    const decipher = crypto.createDecipheriv(algorithm, this.key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  }
}
