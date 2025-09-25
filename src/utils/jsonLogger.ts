// Utility for logging and debugging JSON parsing issues

interface JsonErrorDetails {
  originalText: string;
  cleanedText?: string;
  error: Error;
  position?: number;
  context?: string;
  attemptedFixes?: string[];
}

/**
 * Logs detailed information about JSON parsing failures
 * to help debug malformed JSON from OpenAI responses
 */
export function logJsonParsingError(details: JsonErrorDetails): void {
  console.error('🔥 JSON Parsing Failed - Detailed Report:');
  console.error('=====================================');
  
  // Basic error info
  console.error('Error:', details.error.message);
  console.error('Position:', details.position || 'unknown');
  console.error('Original length:', details.originalText.length);
  
  // Show context around the error position
  if (details.position && typeof details.position === 'number') {
    const start = Math.max(0, details.position - 100);
    const end = Math.min(details.originalText.length, details.position + 100);
    const contextText = details.originalText.slice(start, end);
    console.error('\n📍 Context around position', details.position + ':');
    console.error('---');
    console.error(contextText);
    console.error('---');
    
    // Mark the exact position with a pointer
    const pointer = ' '.repeat(details.position - start) + '^ ERROR HERE';
    console.error(pointer);
  }
  
  // Show head and tail of the JSON
  console.error('\n🔤 JSON Head (first 300 chars):');
  console.error(details.originalText.slice(0, 300));
  
  console.error('\n🔤 JSON Tail (last 200 chars):');
  console.error(details.originalText.slice(-200));
  
  // If we attempted any fixes, show them
  if (details.attemptedFixes && details.attemptedFixes.length > 0) {
    console.error('\n🔧 Attempted fixes:');
    details.attemptedFixes.forEach((fix, index) => {
      console.error(`  ${index + 1}. ${fix}`);
    });
  }
  
  // If we have cleaned text, show a sample
  if (details.cleanedText) {
    console.error('\n🧹 Cleaned text sample (first 300 chars):');
    console.error(details.cleanedText.slice(0, 300));
  }
  
  console.error('\n=====================================');
}

/**
 * Analyzes common JSON syntax issues and suggests fixes
 */
export function analyzeJsonError(jsonText: string, error: Error): string[] {
  const suggestions: string[] = [];
  const errorMsg = error.message.toLowerCase();
  
  if (errorMsg.includes('expected') && errorMsg.includes('after array element')) {
    suggestions.push('Array syntax issue - missing comma or closing bracket');
    
    // Check for common patterns
    if (jsonText.includes('"]')) {
      suggestions.push('Found "] pattern - may need to replace with "}');
    }
    if (jsonText.includes(']{')) {
      suggestions.push('Found "]{ pattern - may need comma between array elements');
    }
  }
  
  if (errorMsg.includes('unexpected token')) {
    suggestions.push('Unexpected character found - check for extra brackets or missing quotes');
  }
  
  if (errorMsg.includes('position')) {
    const posMatch = /position (\d+)/.exec(errorMsg);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const char = jsonText.charAt(pos);
      suggestions.push(`Character at error position: "${char}" (code: ${char.charCodeAt(0)})`);
    }
  }
  
  // Check for common OpenAI response issues
  if (jsonText.includes('```')) {
    suggestions.push('Contains code fences - strip markdown formatting');
  }
  
  if (jsonText.includes('}\s*{')) {
    suggestions.push('Adjacent objects without comma separator');
  }
  
  return suggestions;
}

/**
 * Creates a comprehensive error report for JSON parsing failures
 */
export function createJsonErrorReport(
  originalText: string, 
  error: Error, 
  cleanedText?: string,
  attemptedFixes?: string[]
): JsonErrorDetails {
  const posMatch = /position (\d+)/i.exec(error.message);
  const position = posMatch ? parseInt(posMatch[1], 10) : undefined;
  
  let context = '';
  if (position !== undefined) {
    const start = Math.max(0, position - 50);
    const end = Math.min(originalText.length, position + 50);
    context = originalText.slice(start, end);
  }
  
  const suggestions = analyzeJsonError(originalText, error);
  
  return {
    originalText,
    cleanedText,
    error,
    position,
    context,
    attemptedFixes: [...(attemptedFixes || []), ...suggestions]
  };
}