/**
 * File Security Scanner
 * Comprehensive file upload security scanning and validation
 * Requirements: 10.4, 10.5, 13.1, 13.2, 14.3, 14.4
 */

// File type signatures (magic bytes)
const FILE_SIGNATURES = {
  // Images
  JPEG: [[0xFF, 0xD8, 0xFF]],
  PNG: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  GIF: [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
  ],
  WEBP: [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
  BMP: [[0x42, 0x4D]],
  TIFF: [
    [0x49, 0x49, 0x2A, 0x00], // Little endian
    [0x4D, 0x4D, 0x00, 0x2A]  // Big endian
  ],
  
  // Potentially dangerous files
  PE_EXECUTABLE: [[0x4D, 0x5A]], // MZ header
  ELF_EXECUTABLE: [[0x7F, 0x45, 0x4C, 0x46]], // ELF header
  JAVA_CLASS: [[0xCA, 0xFE, 0xBA, 0xBE]], // Java class file
  ZIP: [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]], // ZIP archive
  RAR: [[0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]], // RAR archive
  PDF: [[0x25, 0x50, 0x44, 0x46]], // PDF
  
  // Scripts and code
  HTML: [[0x3C, 0x68, 0x74, 0x6D, 0x6C], [0x3C, 0x48, 0x54, 0x4D, 0x4C]], // <html or <HTML
  XML: [[0x3C, 0x3F, 0x78, 0x6D, 0x6C]], // <?xml
  JAVASCRIPT: [[0x2F, 0x2F], [0x2F, 0x2A]], // // or /*
}

// Dangerous file extensions
const DANGEROUS_EXTENSIONS = [
  // Executables
  'exe', 'com', 'bat', 'cmd', 'scr', 'pif', 'msi', 'dll',
  
  // Scripts
  'js', 'vbs', 'vbe', 'jse', 'ws', 'wsf', 'wsc', 'wsh',
  'ps1', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2',
  'sh', 'bash', 'zsh', 'fish', 'csh', 'tcsh',
  
  // Web scripts
  'php', 'php3', 'php4', 'php5', 'phtml', 'asp', 'aspx',
  'jsp', 'jspx', 'cfm', 'cfml', 'pl', 'cgi', 'py', 'rb',
  
  // Archives that could contain malware
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  
  // Office macros
  'docm', 'dotm', 'xlsm', 'xltm', 'xlam', 'pptm', 'potm', 'ppam', 'ppsm', 'sldm',
  
  // Other dangerous
  'jar', 'class', 'dex', 'apk', 'ipa', 'dmg', 'pkg', 'deb', 'rpm'
]

// Suspicious content patterns
const SUSPICIOUS_PATTERNS = {
  // Script injection patterns
  SCRIPT_TAGS: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  IFRAME_TAGS: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  OBJECT_TAGS: /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  EMBED_TAGS: /<embed\b[^>]*>/gi,
  
  // JavaScript patterns
  JAVASCRIPT_PROTOCOL: /javascript:/gi,
  EVENT_HANDLERS: /on\w+\s*=/gi,
  
  // PHP patterns
  PHP_TAGS: /<\?php|<\?=|\?>/gi,
  PHP_EVAL: /eval\s*\(/gi,
  
  // Shell command patterns
  SHELL_COMMANDS: /\b(rm|del|format|shutdown|reboot|kill|ps|ls|cat|more|less|wget|curl|nc|netcat)\b/gi,
  
  // SQL injection patterns
  SQL_KEYWORDS: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi,
  
  // Base64 encoded content (potential payload)
  BASE64_LONG: /[A-Za-z0-9+\/]{100,}={0,2}/g,
  
  // Hex encoded content
  HEX_ENCODED: /\\x[0-9a-fA-F]{2}/g,
  
  // Unicode escapes
  UNICODE_ESCAPES: /\\u[0-9a-fA-F]{4}/g
}

export interface SecurityScanResult {
  safe: boolean
  threats: SecurityThreat[]
  warnings: string[]
  fileInfo: {
    detectedType?: string
    declaredType: string
    size: number
    name: string
  }
  scanTime: number
}

export interface SecurityThreat {
  type: 'malware' | 'script_injection' | 'suspicious_content' | 'dangerous_extension' | 'type_mismatch'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location?: string
  pattern?: string
}

/**
 * Comprehensive file security scanner
 */
export class FileSecurityScanner {
  private maxScanSize: number
  private enableDeepScan: boolean

  constructor(options: { maxScanSize?: number; enableDeepScan?: boolean } = {}) {
    this.maxScanSize = options.maxScanSize || 10 * 1024 * 1024 // 10MB max scan
    this.enableDeepScan = options.enableDeepScan ?? true
  }

  /**
   * Scan file for security threats
   */
  async scanFile(file: File): Promise<SecurityScanResult> {
    const startTime = Date.now()
    const threats: SecurityThreat[] = []
    const warnings: string[] = []

    try {
      // 1. Basic file validation
      const basicThreats = this.scanBasicProperties(file)
      threats.push(...basicThreats)

      // 2. File signature validation
      const signatureThreats = await this.scanFileSignature(file)
      threats.push(...signatureThreats.threats)
      warnings.push(...signatureThreats.warnings)

      // 3. Content scanning (if enabled and file is small enough)
      if (this.enableDeepScan && file.size <= this.maxScanSize) {
        const contentThreats = await this.scanFileContent(file)
        threats.push(...contentThreats.threats)
        warnings.push(...contentThreats.warnings)
      } else if (file.size > this.maxScanSize) {
        warnings.push(`File too large for deep content scanning (${file.size} bytes > ${this.maxScanSize} bytes)`)
      }

      // 4. Metadata scanning
      const metadataThreats = await this.scanMetadata(file)
      threats.push(...metadataThreats.threats)
      warnings.push(...metadataThreats.warnings)

      const scanTime = Date.now() - startTime
      const safe = !threats.some(t => t.severity === 'high' || t.severity === 'critical')

      return {
        safe,
        threats,
        warnings,
        fileInfo: {
          detectedType: signatureThreats.detectedType,
          declaredType: file.type,
          size: file.size,
          name: file.name
        },
        scanTime
      }

    } catch (error) {
      return {
        safe: false,
        threats: [{
          type: 'malware',
          severity: 'critical',
          description: `Scan error: ${error.message}`
        }],
        warnings: [],
        fileInfo: {
          declaredType: file.type,
          size: file.size,
          name: file.name
        },
        scanTime: Date.now() - startTime
      }
    }
  }

  /**
   * Scan basic file properties
   */
  private scanBasicProperties(file: File): SecurityThreat[] {
    const threats: SecurityThreat[] = []

    // Check file extension
    const extension = this.getFileExtension(file.name).toLowerCase()
    if (DANGEROUS_EXTENSIONS.includes(extension)) {
      threats.push({
        type: 'dangerous_extension',
        severity: 'high',
        description: `Dangerous file extension: .${extension}`,
        location: 'filename'
      })
    }

    // Check filename for suspicious patterns
    const filename = file.name.toLowerCase()
    
    // Double extensions
    const extensions = filename.split('.').slice(1)
    if (extensions.length > 1) {
      const hasExecutableExtension = extensions.some(ext => 
        ['exe', 'com', 'bat', 'cmd', 'scr', 'pif'].includes(ext)
      )
      if (hasExecutableExtension) {
        threats.push({
          type: 'suspicious_content',
          severity: 'high',
          description: 'File has multiple extensions including executable extension',
          location: 'filename'
        })
      }
    }

    // Suspicious filename patterns
    const suspiciousFilenames = [
      /autorun\.inf/i,
      /desktop\.ini/i,
      /thumbs\.db/i,
      /\.htaccess/i,
      /web\.config/i,
      /config\.php/i,
      /wp-config\.php/i,
      /\.env/i
    ]

    for (const pattern of suspiciousFilenames) {
      if (pattern.test(filename)) {
        threats.push({
          type: 'suspicious_content',
          severity: 'medium',
          description: `Suspicious filename pattern: ${filename}`,
          location: 'filename',
          pattern: pattern.toString()
        })
      }
    }

    // Check for hidden files
    if (filename.startsWith('.') && filename !== '.htaccess') {
      threats.push({
        type: 'suspicious_content',
        severity: 'low',
        description: 'Hidden file detected',
        location: 'filename'
      })
    }

    return threats
  }

  /**
   * Scan file signature (magic bytes)
   */
  private async scanFileSignature(file: File): Promise<{
    threats: SecurityThreat[]
    warnings: string[]
    detectedType?: string
  }> {
    const threats: SecurityThreat[] = []
    const warnings: string[] = []
    let detectedType: string | undefined

    try {
      // Read first 32 bytes for signature detection
      const headerBuffer = await this.readFileHeader(file, 32)
      const headerBytes = new Uint8Array(headerBuffer)

      // Detect actual file type
      detectedType = this.detectFileType(headerBytes)

      // Check for dangerous file types
      if (detectedType) {
        const dangerousTypes = ['PE_EXECUTABLE', 'ELF_EXECUTABLE', 'JAVA_CLASS']
        if (dangerousTypes.includes(detectedType)) {
          threats.push({
            type: 'malware',
            severity: 'critical',
            description: `Executable file detected: ${detectedType}`,
            location: 'file_signature'
          })
        }

        // Check for type mismatch
        if (file.type && !this.isTypeMatch(file.type, detectedType)) {
          const severity = this.getDangerousTypeMismatchSeverity(file.type, detectedType)
          threats.push({
            type: 'type_mismatch',
            severity,
            description: `File type mismatch: declared as ${file.type}, detected as ${detectedType}`,
            location: 'file_signature'
          })
        }
      } else {
        // Unknown file type
        if (file.type.startsWith('image/')) {
          warnings.push('Could not verify image file signature')
        }
      }

      // Check for polyglot files (files that are valid in multiple formats)
      const polyglotCheck = this.checkForPolyglot(headerBytes)
      if (polyglotCheck.isPolyglot) {
        threats.push({
          type: 'suspicious_content',
          severity: 'high',
          description: `Potential polyglot file detected: ${polyglotCheck.types.join(', ')}`,
          location: 'file_signature'
        })
      }

    } catch (error) {
      warnings.push(`Could not read file signature: ${error.message}`)
    }

    return { threats, warnings, detectedType }
  }

  /**
   * Scan file content for malicious patterns
   */
  private async scanFileContent(file: File): Promise<{
    threats: SecurityThreat[]
    warnings: string[]
  }> {
    const threats: SecurityThreat[] = []
    const warnings: string[] = []

    try {
      // Read file content as text (for text-based threats)
      const textContent = await this.readFileAsText(file)
      
      if (textContent) {
        // Scan for suspicious patterns
        for (const [patternName, pattern] of Object.entries(SUSPICIOUS_PATTERNS)) {
          const matches = textContent.match(pattern)
          if (matches) {
            const severity = this.getPatternSeverity(patternName)
            threats.push({
              type: 'script_injection',
              severity,
              description: `Suspicious content pattern detected: ${patternName}`,
              location: 'file_content',
              pattern: patternName
            })
          }
        }

        // Check for embedded files (base64 encoded content)
        const base64Matches = textContent.match(SUSPICIOUS_PATTERNS.BASE64_LONG)
        if (base64Matches && base64Matches.length > 5) {
          threats.push({
            type: 'suspicious_content',
            severity: 'medium',
            description: `Multiple base64 encoded blocks detected (${base64Matches.length})`,
            location: 'file_content'
          })
        }

        // Check for obfuscated content
        const obfuscationScore = this.calculateObfuscationScore(textContent)
        if (obfuscationScore > 0.7) {
          threats.push({
            type: 'suspicious_content',
            severity: 'medium',
            description: `Highly obfuscated content detected (score: ${obfuscationScore.toFixed(2)})`,
            location: 'file_content'
          })
        }
      }

      // Binary content analysis
      const binaryContent = await this.readFileAsBinary(file)
      if (binaryContent) {
        // Check for embedded executables
        const embeddedExeCheck = this.checkForEmbeddedExecutables(binaryContent)
        if (embeddedExeCheck.found) {
          threats.push({
            type: 'malware',
            severity: 'critical',
            description: `Embedded executable detected at offset ${embeddedExeCheck.offset}`,
            location: 'file_content'
          })
        }

        // Check for suspicious byte patterns
        const suspiciousBytesCheck = this.checkForSuspiciousBytes(binaryContent)
        threats.push(...suspiciousBytesCheck)
      }

    } catch (error) {
      warnings.push(`Content scanning error: ${error.message}`)
    }

    return { threats, warnings }
  }

  /**
   * Scan file metadata
   */
  private async scanMetadata(file: File): Promise<{
    threats: SecurityThreat[]
    warnings: string[]
  }> {
    const threats: SecurityThreat[] = []
    const warnings: string[] = []

    // Check file timestamps
    if (file.lastModified) {
      const modifiedDate = new Date(file.lastModified)
      const now = new Date()
      
      // Check for future timestamps
      if (modifiedDate > now) {
        threats.push({
          type: 'suspicious_content',
          severity: 'low',
          description: 'File has future modification timestamp',
          location: 'metadata'
        })
      }
      
      // Check for very old timestamps (potential timestamp manipulation)
      const yearsDiff = (now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
      if (yearsDiff > 20) {
        warnings.push('File has very old modification timestamp')
      }
    }

    // Check file size anomalies
    if (file.type.startsWith('image/')) {
      // Images that are too small might be suspicious
      if (file.size < 100) {
        threats.push({
          type: 'suspicious_content',
          severity: 'low',
          description: 'Image file is suspiciously small',
          location: 'metadata'
        })
      }
      
      // Images that are extremely large might be suspicious
      if (file.size > 100 * 1024 * 1024) { // 100MB
        warnings.push('Image file is extremely large')
      }
    }

    return { threats, warnings }
  }

  /**
   * Helper methods
   */
  private async readFileHeader(file: File, bytes: number): Promise<ArrayBuffer> {
    const slice = file.slice(0, bytes)
    return await slice.arrayBuffer()
  }

  private async readFileAsText(file: File): Promise<string | null> {
    try {
      // Only read first 1MB as text to avoid memory issues
      const maxTextSize = 1024 * 1024
      const slice = file.slice(0, Math.min(file.size, maxTextSize))
      return await slice.text()
    } catch (error) {
      return null
    }
  }

  private async readFileAsBinary(file: File): Promise<Uint8Array | null> {
    try {
      // Only read first 1MB for binary analysis
      const maxBinarySize = 1024 * 1024
      const slice = file.slice(0, Math.min(file.size, maxBinarySize))
      const buffer = await slice.arrayBuffer()
      return new Uint8Array(buffer)
    } catch (error) {
      return null
    }
  }

  private detectFileType(headerBytes: Uint8Array): string | undefined {
    for (const [type, signatures] of Object.entries(FILE_SIGNATURES)) {
      for (const signature of signatures) {
        if (this.matchesSignature(headerBytes, signature)) {
          return type
        }
      }
    }
    return undefined
  }

  private matchesSignature(headerBytes: Uint8Array, signature: (number | null)[]): boolean {
    if (headerBytes.length < signature.length) {
      return false
    }

    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== null && headerBytes[i] !== signature[i]) {
        return false
      }
    }

    return true
  }

  private isTypeMatch(declaredType: string, detectedType: string): boolean {
    const typeMap: Record<string, string[]> = {
      'image/jpeg': ['JPEG'],
      'image/jpg': ['JPEG'],
      'image/png': ['PNG'],
      'image/gif': ['GIF'],
      'image/webp': ['WEBP'],
      'image/bmp': ['BMP'],
      'image/tiff': ['TIFF'],
      'image/tif': ['TIFF']
    }

    const expectedTypes = typeMap[declaredType.toLowerCase()]
    return expectedTypes ? expectedTypes.includes(detectedType) : false
  }

  private getDangerousTypeMismatchSeverity(declaredType: string, detectedType: string): 'low' | 'medium' | 'high' | 'critical' {
    const dangerousDetected = ['PE_EXECUTABLE', 'ELF_EXECUTABLE', 'JAVA_CLASS']
    const scriptTypes = ['HTML', 'XML', 'JAVASCRIPT']

    if (dangerousDetected.includes(detectedType)) {
      return 'critical'
    }

    if (scriptTypes.includes(detectedType) && declaredType.startsWith('image/')) {
      return 'high'
    }

    return 'medium'
  }

  private checkForPolyglot(headerBytes: Uint8Array): { isPolyglot: boolean; types: string[] } {
    const detectedTypes: string[] = []

    // Check if file matches multiple signatures
    for (const [type, signatures] of Object.entries(FILE_SIGNATURES)) {
      for (const signature of signatures) {
        if (this.matchesSignature(headerBytes, signature)) {
          detectedTypes.push(type)
          break
        }
      }
    }

    return {
      isPolyglot: detectedTypes.length > 1,
      types: detectedTypes
    }
  }

  private getPatternSeverity(patternName: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'SCRIPT_TAGS': 'high',
      'IFRAME_TAGS': 'high',
      'OBJECT_TAGS': 'high',
      'EMBED_TAGS': 'medium',
      'JAVASCRIPT_PROTOCOL': 'high',
      'EVENT_HANDLERS': 'medium',
      'PHP_TAGS': 'high',
      'PHP_EVAL': 'critical',
      'SHELL_COMMANDS': 'high',
      'SQL_KEYWORDS': 'medium',
      'BASE64_LONG': 'low',
      'HEX_ENCODED': 'low',
      'UNICODE_ESCAPES': 'low'
    }

    return severityMap[patternName] || 'medium'
  }

  private calculateObfuscationScore(content: string): number {
    let score = 0
    const length = content.length

    if (length === 0) return 0

    // Check for high entropy (random-looking content)
    const entropy = this.calculateEntropy(content)
    if (entropy > 4.5) score += 0.3

    // Check for excessive escape sequences
    const escapeCount = (content.match(/\\[xun][0-9a-fA-F]/g) || []).length
    if (escapeCount / length > 0.1) score += 0.2

    // Check for long strings without spaces
    const longStrings = content.match(/\S{50,}/g) || []
    if (longStrings.length > 5) score += 0.2

    // Check for excessive punctuation
    const punctuationCount = (content.match(/[^\w\s]/g) || []).length
    if (punctuationCount / length > 0.3) score += 0.2

    // Check for base64-like patterns
    const base64Like = (content.match(/[A-Za-z0-9+\/]{20,}/g) || []).length
    if (base64Like > 10) score += 0.1

    return Math.min(score, 1.0)
  }

  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {}
    
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1
    }

    let entropy = 0
    const length = str.length

    for (const count of Object.values(freq)) {
      const p = count / length
      entropy -= p * Math.log2(p)
    }

    return entropy
  }

  private checkForEmbeddedExecutables(bytes: Uint8Array): { found: boolean; offset?: number } {
    const executableSignatures = [
      [0x4D, 0x5A], // PE executable
      [0x7F, 0x45, 0x4C, 0x46], // ELF executable
      [0xCA, 0xFE, 0xBA, 0xBE] // Java class
    ]

    for (let i = 100; i < bytes.length - 10; i++) { // Skip first 100 bytes (normal headers)
      for (const signature of executableSignatures) {
        let match = true
        for (let j = 0; j < signature.length; j++) {
          if (i + j >= bytes.length || bytes[i + j] !== signature[j]) {
            match = false
            break
          }
        }
        if (match) {
          return { found: true, offset: i }
        }
      }
    }

    return { found: false }
  }

  private checkForSuspiciousBytes(bytes: Uint8Array): SecurityThreat[] {
    const threats: SecurityThreat[] = []

    // Check for null bytes in text files (potential binary injection)
    let nullByteCount = 0
    for (const byte of bytes) {
      if (byte === 0) nullByteCount++
    }

    if (nullByteCount > bytes.length * 0.1) { // More than 10% null bytes
      threats.push({
        type: 'suspicious_content',
        severity: 'medium',
        description: `High number of null bytes detected (${nullByteCount})`,
        location: 'file_content'
      })
    }

    // Check for high entropy regions (potential encrypted/compressed payloads)
    const chunkSize = 1024
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize)
      const entropy = this.calculateByteEntropy(chunk)
      
      if (entropy > 7.5) { // Very high entropy
        threats.push({
          type: 'suspicious_content',
          severity: 'low',
          description: `High entropy region detected at offset ${i} (entropy: ${entropy.toFixed(2)})`,
          location: 'file_content'
        })
      }
    }

    return threats
  }

  private calculateByteEntropy(bytes: Uint8Array): number {
    const freq = new Array(256).fill(0)
    
    for (const byte of bytes) {
      freq[byte]++
    }

    let entropy = 0
    const length = bytes.length

    for (const count of freq) {
      if (count > 0) {
        const p = count / length
        entropy -= p * Math.log2(p)
      }
    }

    return entropy
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()! : ''
  }
}

// Export singleton instance
export const fileSecurityScanner = new FileSecurityScanner()

console.log('File security scanner loaded')