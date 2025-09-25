import { RequestHandler } from "express";

// Simple debug endpoint to test JSON parsing and error handling
export const testJsonParsing: RequestHandler = async (req, res, next) => {
  try {
    const { testJson } = req.body || {};
    
    if (!testJson) {
      res.status(400).json({ 
        success: false, 
        error: "testJson parameter is required in request body" 
      });
      return;
    }

    // Try to parse the provided JSON
    try {
      const parsed = JSON.parse(testJson);
      res.json({
        success: true,
        message: "JSON parsed successfully",
        parsed: parsed,
        originalLength: testJson.length
      });
    } catch (parseError: any) {
      // Extract position information if available
      const posMatch = /position (\d+)/i.exec(parseError.message);
      const position = posMatch ? parseInt(posMatch[1], 10) : null;
      
      let context = "";
      if (position !== null) {
        const start = Math.max(0, position - 100);
        const end = Math.min(testJson.length, position + 100);
        context = testJson.slice(start, end);
      }

      res.status(400).json({
        success: false,
        error: "JSON parsing failed",
        details: {
          message: parseError.message,
          position: position,
          context: context,
          jsonLength: testJson.length,
          jsonHead: testJson.slice(0, 200),
          jsonTail: testJson.slice(-200)
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getSystemInfo: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      success: true,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development',
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    next(error);
  }
};