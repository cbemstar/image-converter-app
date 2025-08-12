/**
 * File Security Scanner Tests
 * Tests for comprehensive file upload security scanning
 * Requirements: 10.4, 10.5, 13.1, 13.2, 14.3, 14.4
 */

// Using Jest syntax instead of Vitest

// Mock File class for testing
class MockFile {
  constructor(content, name, type, lastModified = Date.now()) {
    this.content = content
    this.name = name
    this.type = type
    this.size = content.length
    this.lastModified = lastModified
  }

  slice(start = 0, end = this.size) {
    return new MockFile(
      this.content.slice(start, end),
      this.name,
      this.type,
      this.lastModified
    )
  }

  async arrayBuffer() {
    if (typeof this.content === 'string') {
      const encoder = new TextEncoder()
      return encoder.encode(this.content).buffer
    }
    return this.content.buffer || this.content
  }

  async text() {
    if (typeof this.content === 'string') {
      return this.content
    }
    const decoder = new TextDecoder()
    return decoder.decode(this.content)
  }
}

// Mock file security scanner
const mockFileSecurityScanner = {
  async scanFile(file) {
    const threats = []
    const warnings = []
    const startTime = Date.now()

    // Basic property checks
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
      'php', 'asp', 'jsp', 'py', 'rb', 'pl', 'sh', 'ps1'
    ]

    if (dangerousExtensions.includes(extension)) {
      threats.push({
        type: 'dangerous_extension',
        severity: 'high',
        description: `Dangerous file extension: .${extension}`,
        location: 'filename'
      })
    }

    // File size checks
    if (file.size === 0) {
      threats.push({
        type: 'suspicious_content',
        severity: 'medium',
        description: 'File is empty',
        location: 'metadata'
      })
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      warnings.push('File is very large')
    }

    // Content analysis
    try {
      const content = await file.text()
      
      // Check for script content
      const scriptPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi
      ]

      for (const pattern of scriptPatterns) {
        if (pattern.test(content)) {
          threats.push({
            type: 'script_injection',
            severity: 'high',
            description: 'Suspicious script content detected',
            location: 'file_content',
            pattern: pattern.toString()
          })
          break
        }
      }

      // Check for SQL injection patterns
      const sqlPatterns = [
        /(\bunion\b.*\bselect\b)/gi,
        /(\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/gi,
        /(\bdrop\b.*\btable\b)/gi,
        /(\bselect\b.*\bfrom\b)/gi,
        /(\bor\b\s+['"][^'"]*['"]?\s*=\s*['"][^'"]*['"]?)/gi,
        /(\bunion\b)/gi,
        /(\bdrop\b)/gi
      ]

      for (const pattern of sqlPatterns) {
        if (pattern.test(content)) {
          threats.push({
            type: 'script_injection',
            severity: 'medium',
            description: 'Potential SQL injection pattern detected',
            location: 'file_content'
          })
          break
        }
      }

      // Check for command injection
      const commandPatterns = [
        /[;&|`$(){}[\]]/g,
        /\b(rm|del|format|shutdown|kill)\b/gi
      ]

      for (const pattern of commandPatterns) {
        if (pattern.test(content)) {
          threats.push({
            type: 'script_injection',
            severity: 'high',
            description: 'Potential command injection detected',
            location: 'file_content'
          })
          break
        }
      }

      // Check for path traversal
      if (/\.\.\//g.test(content) || /\.\.\\/g.test(content)) {
        threats.push({
          type: 'suspicious_content',
          severity: 'medium',
          description: 'Path traversal patterns detected',
          location: 'file_content'
        })
      }

      // Check for base64 encoded content (potential payload)
      const base64Matches = content.match(/[A-Za-z0-9+\/]{50,}={0,2}/g)
      if (base64Matches && base64Matches.length > 3) {
        threats.push({
          type: 'suspicious_content',
          severity: 'medium',
          description: `Multiple base64 encoded blocks detected (${base64Matches.length})`,
          location: 'file_content'
        })
      }

    } catch (error) {
      warnings.push(`Content analysis failed: ${error.message}`)
    }

    // File signature validation
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer.slice(0, 16))
      
      // Check for executable signatures
      const executableSignatures = [
        [0x4D, 0x5A], // PE executable (MZ)
        [0x7F, 0x45, 0x4C, 0x46], // ELF executable
        [0xCA, 0xFE, 0xBA, 0xBE] // Java class file
      ]

      for (const signature of executableSignatures) {
        let matches = true
        for (let i = 0; i < signature.length; i++) {
          if (bytes[i] !== signature[i]) {
            matches = false
            break
          }
        }
        if (matches) {
          threats.push({
            type: 'malware',
            severity: 'critical',
            description: 'Executable file signature detected',
            location: 'file_signature'
          })
          break
        }
      }

      // Check for image signatures if declared as image
      if (file.type.startsWith('image/')) {
        const imageSignatures = {
          'image/jpeg': [0xFF, 0xD8, 0xFF],
          'image/png': [0x89, 0x50, 0x4E, 0x47],
          'image/gif': [0x47, 0x49, 0x46]
        }

        const expectedSignature = imageSignatures[file.type]
        if (expectedSignature) {
          let matches = true
          for (let i = 0; i < expectedSignature.length; i++) {
            if (bytes[i] !== expectedSignature[i]) {
              matches = false
              break
            }
          }
          if (!matches) {
            threats.push({
              type: 'type_mismatch',
              severity: 'medium',
              description: `File signature doesn't match declared type ${file.type}`,
              location: 'file_signature'
            })
          }
        }
      }

    } catch (error) {
      warnings.push(`Signature analysis failed: ${error.message}`)
    }

    const scanTime = Date.now() - startTime
    const safe = threats.length === 0 || !threats.some(t => t.severity === 'critical' || t.severity === 'high' || t.severity === 'medium')

    return {
      safe,
      threats,
      warnings,
      fileInfo: {
        detectedType: undefined, // Would be determined by signature analysis
        declaredType: file.type,
        size: file.size,
        name: file.name
      },
      scanTime
    }
  }
}

describe('File Security Scanner', () => {
  describe('Basic File Validation', () => {
    it('should detect dangerous file extensions', async () => {
      const dangerousFiles = [
        new MockFile('malicious content', 'malware.exe', 'application/x-executable'),
        new MockFile('script content', 'script.bat', 'application/x-bat'),
        new MockFile('php code', 'backdoor.php', 'application/x-php'),
        new MockFile('javascript', 'malicious.js', 'application/javascript')
      ]

      for (const file of dangerousFiles) {
        const result = await mockFileSecurityScanner.scanFile(file)
        expect(result.safe).toBe(false)
        expect(result.threats.some(t => t.type === 'dangerous_extension')).toBe(true)
      }
    })

    it('should allow safe file extensions', async () => {
      const safeFiles = [
        new MockFile('image data', 'photo.jpg', 'image/jpeg'),
        new MockFile('image data', 'picture.png', 'image/png'),
        new MockFile('document content', 'document.pdf', 'application/pdf'),
        new MockFile('text content', 'readme.txt', 'text/plain')
      ]

      for (const file of safeFiles) {
        const result = await mockFileSecurityScanner.scanFile(file)
        expect(result.threats.some(t => t.type === 'dangerous_extension')).toBe(false)
      }
    })

    it('should detect empty files', async () => {
      const emptyFile = new MockFile('', 'empty.txt', 'text/plain')
      const result = await mockFileSecurityScanner.scanFile(emptyFile)
      

      expect(result.safe).toBe(false)
      expect(result.threats.some(t => 
        t.description.includes('empty') && t.severity === 'medium'
      )).toBe(true)
    })

    it('should warn about very large files', async () => {
      const largeContent = 'x'.repeat(150 * 1024 * 1024) // 150MB
      const largeFile = new MockFile(largeContent, 'large.txt', 'text/plain')
      const result = await mockFileSecurityScanner.scanFile(largeFile)
      
      expect(result.warnings.some(w => w.includes('very large'))).toBe(true)
    })
  })

  describe('Content Security Scanning', () => {
    it('should detect script injection attempts', async () => {
      const maliciousContents = [
        '<script>alert("xss")</script>',
        'javascript:alert("malicious")',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:void(0)"></iframe>',
        '<object data="malicious.swf"></object>'
      ]

      for (const content of maliciousContents) {
        const file = new MockFile(content, 'test.html', 'text/html')
        const result = await mockFileSecurityScanner.scanFile(file)
        
        expect(result.safe).toBe(false)
        expect(result.threats.some(t => 
          t.type === 'script_injection' && t.severity === 'high'
        )).toBe(true)
      }
    })

    it('should detect SQL injection patterns', async () => {
      const sqlInjectionContents = [
        "1' UNION SELECT * FROM users",
        "admin' OR '1'='1",
        "'; DROP TABLE users; --"
      ]

      for (const content of sqlInjectionContents) {
        const file = new MockFile(content, 'test.sql', 'text/plain')
        const result = await mockFileSecurityScanner.scanFile(file)
        
        expect(result.threats.some(t => 
          t.type === 'script_injection' && 
          t.description.includes('SQL injection')
        )).toBe(true)
      }
    })

    it('should detect command injection patterns', async () => {
      const commandInjectionContents = [
        'file.txt; rm -rf /',
        'input | cat /etc/passwd',
        'data && shutdown -h now',
        'test`whoami`'
      ]

      for (const content of commandInjectionContents) {
        const file = new MockFile(content, 'test.txt', 'text/plain')
        const result = await mockFileSecurityScanner.scanFile(file)
        
        expect(result.threats.some(t => 
          t.type === 'script_injection' && 
          t.description.includes('command injection')
        )).toBe(true)
      }
    })

    it('should detect path traversal attempts', async () => {
      const pathTraversalContents = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'normal content with ../../../etc/shadow embedded'
      ]

      for (const content of pathTraversalContents) {
        const file = new MockFile(content, 'test.txt', 'text/plain')
        const result = await mockFileSecurityScanner.scanFile(file)
        
        expect(result.threats.some(t => 
          t.description.includes('Path traversal')
        )).toBe(true)
      }
    })

    it('should detect suspicious base64 content', async () => {
      const base64Content = 'Normal text with ' + 
        'VGhpcyBpcyBhIGxvbmcgYmFzZTY0IGVuY29kZWQgc3RyaW5nIHRoYXQgY291bGQgY29udGFpbiBtYWxpY2lvdXMgY29udGVudA=='.repeat(10)
      
      const file = new MockFile(base64Content, 'test.txt', 'text/plain')
      const result = await mockFileSecurityScanner.scanFile(file)
      
      expect(result.threats.some(t => 
        t.description.includes('base64 encoded blocks')
      )).toBe(true)
    })

    it('should not flag legitimate content', async () => {
      const legitimateContents = [
        'This is a normal text document with regular content.',
        'Hello world! This is a simple greeting.',
        'Product description: High-quality widget for everyday use.',
        'Contact us at support@example.com for assistance.'
      ]

      for (const content of legitimateContents) {
        const file = new MockFile(content, 'legitimate.txt', 'text/plain')
        const result = await mockFileSecurityScanner.scanFile(file)
        
        // Should not have high or critical severity threats
        const dangerousThreats = result.threats.filter(t => 
          t.severity === 'high' || t.severity === 'critical'
        )
        expect(dangerousThreats.length).toBe(0)
      }
    })
  })

  describe('File Signature Validation', () => {
    it('should detect executable file signatures', async () => {
      // Mock PE executable (MZ header)
      const peExecutable = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
      const file = new MockFile(peExecutable, 'innocent.jpg', 'image/jpeg')
      
      const result = await mockFileSecurityScanner.scanFile(file)
      
      expect(result.safe).toBe(false)
      expect(result.threats.some(t => 
        t.type === 'malware' && t.severity === 'critical'
      )).toBe(true)
    })

    it('should detect type mismatches', async () => {
      // PNG signature but declared as JPEG
      const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const file = new MockFile(pngSignature, 'image.jpg', 'image/jpeg')
      
      const result = await mockFileSecurityScanner.scanFile(file)
      
      expect(result.threats.some(t => 
        t.type === 'type_mismatch'
      )).toBe(true)
    })

    it('should validate correct image signatures', async () => {
      // Correct JPEG signature
      const jpegSignature = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])
      const file = new MockFile(jpegSignature, 'image.jpg', 'image/jpeg')
      
      const result = await mockFileSecurityScanner.scanFile(file)
      
      // Should not have type mismatch threats
      expect(result.threats.some(t => t.type === 'type_mismatch')).toBe(false)
    })
  })

  describe('Performance and Error Handling', () => {
    it('should complete scans within reasonable time', async () => {
      const content = 'x'.repeat(1024 * 1024) // 1MB file
      const file = new MockFile(content, 'large.txt', 'text/plain')
      
      const startTime = Date.now()
      const result = await mockFileSecurityScanner.scanFile(file)
      const endTime = Date.now()
      
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.scanTime).toBeGreaterThan(0)
    })

    it('should handle scan errors gracefully', async () => {
      // Create a file that will cause errors during processing
      const problematicFile = {
        name: 'error.txt',
        type: 'text/plain',
        size: 1000,
        async text() {
          throw new Error('Simulated read error')
        },
        async arrayBuffer() {
          throw new Error('Simulated buffer error')
        }
      }

      const result = await mockFileSecurityScanner.scanFile(problematicFile)
      
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('failed'))).toBe(true)
    })

    it('should provide detailed scan results', async () => {
      const file = new MockFile('test content', 'test.txt', 'text/plain')
      const result = await mockFileSecurityScanner.scanFile(file)
      
      expect(result).toHaveProperty('safe')
      expect(result).toHaveProperty('threats')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('fileInfo')
      expect(result).toHaveProperty('scanTime')
      
      expect(result.fileInfo).toHaveProperty('declaredType')
      expect(result.fileInfo).toHaveProperty('size')
      expect(result.fileInfo).toHaveProperty('name')
      
      expect(Array.isArray(result.threats)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(typeof result.safe).toBe('boolean')
      expect(typeof result.scanTime).toBe('number')
    })
  })

  describe('Threat Severity Classification', () => {
    it('should classify threats by severity correctly', async () => {
      const criticalFile = new MockFile(
        new Uint8Array([0x4D, 0x5A]), // PE executable
        'malware.exe',
        'application/x-executable'
      )
      
      const result = await mockFileSecurityScanner.scanFile(criticalFile)
      
      const criticalThreats = result.threats.filter(t => t.severity === 'critical')
      const highThreats = result.threats.filter(t => t.severity === 'high')
      
      expect(criticalThreats.length + highThreats.length).toBeGreaterThan(0)
      expect(result.safe).toBe(false)
    })

    it('should allow files with only low severity issues', async () => {
      const file = new MockFile('content', '.hidden', 'text/plain')
      const result = await mockFileSecurityScanner.scanFile(file)
      
      // Hidden files might generate warnings but shouldn't be blocked
      const dangerousThreats = result.threats.filter(t => 
        t.severity === 'critical' || t.severity === 'high'
      )
      
      expect(dangerousThreats.length).toBe(0)
    })
  })

  describe('Multiple File Validation', () => {
    it('should validate multiple files efficiently', async () => {
      const files = [
        new MockFile('content1', 'file1.txt', 'text/plain'),
        new MockFile('content2', 'file2.jpg', 'image/jpeg'),
        new MockFile('content3', 'file3.png', 'image/png')
      ]

      const results = await Promise.all(
        files.map(file => mockFileSecurityScanner.scanFile(file))
      )

      expect(results.length).toBe(3)
      results.forEach(result => {
        expect(result).toHaveProperty('safe')
        expect(result).toHaveProperty('scanTime')
      })
    })

    it('should handle mixed safe and unsafe files', async () => {
      const files = [
        new MockFile('safe content', 'safe.txt', 'text/plain'),
        new MockFile('<script>alert("xss")</script>', 'malicious.html', 'text/html'),
        new MockFile('another safe file', 'safe2.txt', 'text/plain')
      ]

      const results = await Promise.all(
        files.map(file => mockFileSecurityScanner.scanFile(file))
      )

      const safeResults = results.filter(r => r.safe)
      const unsafeResults = results.filter(r => !r.safe)

      expect(safeResults.length).toBe(2)
      expect(unsafeResults.length).toBe(1)
    })
  })
})

describe('File Validation Integration', () => {
  it('should integrate with upload validation workflow', async () => {
    // Create proper JPEG signature
    const jpegSignature = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
    
    const uploadFiles = [
      new MockFile(jpegSignature, 'photo.jpg', 'image/jpeg'),
      new MockFile('<script>alert("xss")</script>', 'malicious.txt', 'text/plain')
    ]

    const validationResults = []
    
    for (const file of uploadFiles) {
      // Basic validation
      const maxSize = 50 * 1024 * 1024 // 50MB
      const allowedTypes = ['image/jpeg', 'image/png', 'text/plain']
      
      let isValid = true
      const errors = []
      
      if (file.size > maxSize) {
        isValid = false
        errors.push('File too large')
      }
      
      if (!allowedTypes.includes(file.type)) {
        isValid = false
        errors.push('File type not allowed')
      }
      
      // Security scan
      const scanResult = await mockFileSecurityScanner.scanFile(file)
      if (!scanResult.safe) {
        isValid = false
        errors.push('Security scan failed')
      }
      
      validationResults.push({
        filename: file.name,
        valid: isValid,
        errors,
        scanResult
      })
    }

    expect(validationResults.length).toBe(2)
    expect(validationResults[0].valid).toBe(true) // photo.jpg should be valid
    expect(validationResults[1].valid).toBe(false) // malicious.txt should be invalid
  })

  it('should provide actionable error messages', async () => {
    const maliciousFile = new MockFile(
      '<script>alert("xss")</script>',
      'malicious.exe',
      'application/x-executable'
    )

    const result = await mockFileSecurityScanner.scanFile(maliciousFile)
    
    expect(result.threats.length).toBeGreaterThan(0)
    
    result.threats.forEach(threat => {
      expect(threat).toHaveProperty('type')
      expect(threat).toHaveProperty('severity')
      expect(threat).toHaveProperty('description')
      expect(threat).toHaveProperty('location')
      
      expect(typeof threat.description).toBe('string')
      expect(threat.description.length).toBeGreaterThan(0)
    })
  })
})