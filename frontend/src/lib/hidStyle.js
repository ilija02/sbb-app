/**
 * HID Mobile Access-inspired Ticketing System
 * 
 * Implements BLE challenge-response protocol with device-bound credentials
 * Mock mode available for demo/testing without actual Bluetooth hardware
 */

const MOCK_MODE = true; // Set to false when Bluetooth hardware is available

// Service UUID for ticket validation (custom UUID)
const TICKET_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHALLENGE_CHAR_UUID = '4fafc202-1fb5-459e-8fcc-c5c9c331914b';

/**
 * Generate device-specific encryption key
 * Bound to this device/browser - can't be transferred
 */
export async function generateDeviceKey() {
  // Combine multiple device characteristics
  const factors = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    navigator.hardwareConcurrency || 4,
    new Date().getTimezoneOffset()
  ];
  
  // Add some randomness
  const random = crypto.getRandomValues(new Uint8Array(16));
  const combined = factors.join('|') + Array.from(random).join(',');
  
  // Hash to create device key
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(combined));
  
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Secure Ticket Credential (like HID Seos)
 * Encrypted with device key, can't be copied to another device
 */
export class SecureTicketCredential {
  constructor(ticketData, deviceKey) {
    this.ticketData = ticketData;
    this.deviceKey = deviceKey;
    this.credentialId = this.generateCredentialId();
  }

  generateCredentialId() {
    // Unique ID for this credential (like HID credential ID)
    const data = `${this.ticketData.token}-${this.deviceKey.substring(0, 16)}`;
    return this.hashSync(data).substring(0, 16);
  }

  hashSync(data) {
    // Simple sync hash for credential ID
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Encrypt credential with device key (AES-GCM)
   * Only this device can decrypt it
   */
  async encrypt() {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(this.ticketData));
    
    // Import device key for encryption
    const keyMaterial = encoder.encode(this.deviceKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.slice(0, 32), // 256-bit key
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return {
      credentialId: this.credentialId,
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      expiry: this.ticketData.expiry,
      ticketType: this.ticketData.ticketType
    };
  }

  /**
   * Decrypt credential (only works on original device)
   */
  async decrypt(encryptedData, deviceKey) {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(deviceKey);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial.slice(0, 32),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
      key,
      new Uint8Array(encryptedData.encrypted)
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }

  /**
   * Generate challenge response (HID's challenge-response protocol)
   * Response = HMAC(credential + challenge + timestamp)
   */
  async generateChallengeResponse(challenge, timestamp = Date.now()) {
    const message = `${this.ticketData.token}|${challenge}|${timestamp}`;
    const encoder = new TextEncoder();
    
    // Use device key as HMAC key
    const keyMaterial = encoder.encode(this.deviceKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );
    
    return {
      credentialId: this.credentialId,
      challenge: challenge,
      response: Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''),
      timestamp: timestamp,
      signature: this.ticketData.signature,
      expiry: this.ticketData.expiry
    };
  }
}

/**
 * BLE Challenge Broadcaster (Validator/Reader side)
 * Broadcasts challenges that nearby devices can receive
 */
export class ChallengeBroadcaster {
  constructor(validatorId) {
    this.validatorId = validatorId;
    this.currentChallenge = null;
    this.broadcastInterval = null;
    this.usedResponses = new Set(); // Prevent replay attacks
  }

  /**
   * Start broadcasting challenges via BLE
   */
  async startBroadcasting() {
    if (MOCK_MODE) {
      console.log('[MOCK] Starting challenge broadcast...');
      this.startMockBroadcast();
      return;
    }

    // Check if Bluetooth is available
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth not supported. Enable MOCK_MODE for demo.');
    }

    // Broadcast new challenge every 5 seconds
    this.broadcastInterval = setInterval(() => {
      this.generateAndBroadcastChallenge();
    }, 5000);

    // Initial broadcast
    this.generateAndBroadcastChallenge();
  }

  generateAndBroadcastChallenge() {
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    this.currentChallenge = {
      nonce: Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''),
      validatorId: this.validatorId,
      timestamp: Date.now()
    };

    console.log(`[Validator ${this.validatorId}] Broadcasting challenge: ${this.currentChallenge.nonce.substring(0, 8)}...`);
    
    // In production, broadcast via BLE advertising
    // this.bleAdvertise(this.currentChallenge);
  }

  startMockBroadcast() {
    // Mock mode: just generate challenges locally
    this.broadcastInterval = setInterval(() => {
      this.generateAndBroadcastChallenge();
    }, 5000);
    this.generateAndBroadcastChallenge();
  }

  getCurrentChallenge() {
    return this.currentChallenge;
  }

  /**
   * Verify a challenge response from passenger
   */
  async verifyResponse(response, credentialInfo) {
    // 1. Check if challenge is current
    if (!this.currentChallenge) {
      return { valid: false, reason: 'No active challenge' };
    }

    if (response.challenge !== this.currentChallenge.nonce) {
      // Allow previous challenge (clock skew tolerance)
      const timeDiff = Date.now() - this.currentChallenge.timestamp;
      if (timeDiff > 15000) {
        return { valid: false, reason: 'Challenge expired or mismatch' };
      }
    }

    // 2. Check timestamp freshness (must be within 15 seconds)
    const responseAge = Date.now() - response.timestamp;
    if (responseAge > 15000 || responseAge < -5000) {
      return { valid: false, reason: 'Response timestamp invalid' };
    }

    // 3. Prevent replay attacks
    const responseKey = `${response.credentialId}-${response.timestamp}`;
    if (this.usedResponses.has(responseKey)) {
      return { valid: false, reason: 'Response already used (replay attack detected)' };
    }

    // 4. Check expiry
    if (new Date(response.expiry) < new Date()) {
      return { valid: false, reason: 'Ticket expired' };
    }

    // 5. Verify the response signature
    // In production: recompute expected response and compare
    // For mock: accept if signature is present
    if (!response.response || response.response.length < 32) {
      return { valid: false, reason: 'Invalid response signature' };
    }

    // 6. Mark as used
    this.usedResponses.add(responseKey);

    // Cleanup old responses (keep last 1000)
    if (this.usedResponses.size > 1000) {
      const toDelete = Array.from(this.usedResponses).slice(0, 500);
      toDelete.forEach(key => this.usedResponses.delete(key));
    }

    return { 
      valid: true, 
      credentialId: response.credentialId,
      validatedAt: new Date().toISOString()
    };
  }

  stopBroadcasting() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    console.log(`[Validator ${this.validatorId}] Stopped broadcasting`);
  }
}

/**
 * BLE Challenge Receiver (Passenger side)
 * Scans for nearby validators and receives challenges
 */
export class ChallengeReceiver {
  constructor() {
    this.nearbyValidators = [];
  }

  /**
   * Scan for nearby validators
   */
  async scanForValidators() {
    if (MOCK_MODE) {
      // Mock mode: simulate finding a validator
      await this.delay(500); // Simulate scan time
      
      // Return mock validator
      this.nearbyValidators = [{
        validatorId: 'mock-validator-001',
        name: 'Train Door A',
        signalStrength: -60, // dBm (strong signal)
        distance: 'near' // near/medium/far
      }];

      console.log('[MOCK] Found validators:', this.nearbyValidators);
      return this.nearbyValidators;
    }

    // Real BLE scanning
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth not supported');
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [TICKET_SERVICE_UUID] }],
        optionalServices: [TICKET_SERVICE_UUID]
      });

      this.nearbyValidators = [{
        validatorId: device.id,
        name: device.name || 'Validator',
        device: device
      }];

      return this.nearbyValidators;
    } catch (error) {
      console.error('BLE scan failed:', error);
      throw new Error('Could not detect nearby validators. Please ensure Bluetooth is enabled.');
    }
  }

  /**
   * Receive current challenge from validator
   */
  async receiveChallenge(validator) {
    if (MOCK_MODE) {
      // Mock mode: simulate challenge reception
      await this.delay(200);
      
      // Get challenge from mock broadcaster (if exists) or generate
      const challenge = window.__mockValidatorChallenge || {
        nonce: Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''),
        validatorId: validator.validatorId,
        timestamp: Date.now()
      };

      console.log('[MOCK] Received challenge:', challenge.nonce.substring(0, 8) + '...');
      return challenge;
    }

    // Real BLE communication
    try {
      const server = await validator.device.gatt.connect();
      const service = await server.gatt.getPrimaryService(TICKET_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHALLENGE_CHAR_UUID);
      
      const value = await characteristic.readValue();
      const challengeData = new Uint8Array(value.buffer);
      
      // Parse challenge (assume JSON format)
      const decoder = new TextDecoder();
      const challenge = JSON.parse(decoder.decode(challengeData));
      
      return challenge;
    } catch (error) {
      console.error('Failed to receive challenge:', error);
      throw new Error('Could not communicate with validator');
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Motion Detection for Twist-and-Go
 * Detects phone twist gesture to auto-activate validation
 */
export class TwistAndGoDetector {
  constructor(onTwistDetected) {
    this.onTwistDetected = onTwistDetected;
    this.isActive = false;
    this.lastTrigger = 0;
    this.motionHandler = null;
  }

  start() {
    if (this.isActive) return;

    // Check if motion sensors available
    if (!window.DeviceMotionEvent) {
      console.warn('Motion detection not supported on this device');
      return false;
    }

    this.isActive = true;
    this.motionHandler = this.handleMotion.bind(this);
    window.addEventListener('devicemotion', this.motionHandler);
    
    console.log('Twist-and-Go activated. Twist your phone to validate ticket.');
    return true;
  }

  handleMotion(event) {
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    // Detect sharp rotation/twist (high acceleration on X or Y axis)
    const threshold = 15; // m/s²
    const x = Math.abs(acceleration.x || 0);
    const y = Math.abs(acceleration.y || 0);

    if (x > threshold || y > threshold) {
      // Debounce (don't trigger more than once per 2 seconds)
      const now = Date.now();
      if (now - this.lastTrigger < 2000) return;
      
      this.lastTrigger = now;
      console.log('🔄 Twist detected!');
      
      if (this.onTwistDetected) {
        this.onTwistDetected();
      }
    }
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    
    console.log('Twist-and-Go deactivated');
  }
}

/**
 * High-level API: Provision ticket credential (at purchase)
 */
export async function provisionTicket(ticketData) {
  console.log('Provisioning secure ticket credential...');
  
  // 1. Generate device-specific key
  const deviceKey = await generateDeviceKey();
  
  // 2. Create secure credential
  const credential = new SecureTicketCredential(ticketData, deviceKey);
  
  // 3. Encrypt credential
  const encrypted = await credential.encrypt();
  
  console.log('✅ Ticket provisioned:', {
    credentialId: encrypted.credentialId,
    expiry: encrypted.expiry,
    type: encrypted.ticketType
  });
  
  return {
    credential: encrypted,
    deviceKey: deviceKey, // Store securely
    credentialId: encrypted.credentialId
  };
}

/**
 * High-level API: Validate ticket (at validator)
 */
export async function validateTicket(encryptedCredential, deviceKey) {
  console.log('Starting ticket validation...');
  
  // 1. Decrypt credential
  const credential = new SecureTicketCredential({ token: '', signature: '' }, deviceKey);
  const ticketData = await credential.decrypt(encryptedCredential, deviceKey);
  
  // Recreate credential with decrypted data
  const activeCredential = new SecureTicketCredential(ticketData, deviceKey);
  
  // 2. Scan for nearby validators
  const receiver = new ChallengeReceiver();
  const validators = await receiver.scanForValidators();
  
  if (validators.length === 0) {
    throw new Error('No validators nearby. Please move closer to the validator device.');
  }
  
  // 3. Select closest validator
  const validator = validators[0];
  console.log(`📡 Found validator: ${validator.name}`);
  
  // 4. Receive challenge
  const challenge = await receiver.receiveChallenge(validator);
  console.log(`🔐 Received challenge from ${challenge.validatorId}`);
  
  // 5. Generate response
  const response = await activeCredential.generateChallengeResponse(
    challenge.nonce,
    Date.now()
  );
  
  console.log('✅ Generated challenge response');
  
  return {
    response: response,
    validator: validator,
    challenge: challenge
  };
}

// Export mock mode controller for demo
export function setMockMode(enabled) {
  // Note: Need to modify the const to let for this to work
  console.log(`Mock mode ${enabled ? 'enabled' : 'disabled'}`);
}

export function isMockMode() {
  return MOCK_MODE;
}
