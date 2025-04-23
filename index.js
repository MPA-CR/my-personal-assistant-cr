// Simple Node.js entry point
console.log("Starting application...");
try {
  // For TypeScript support
  require("tsx/dist/cli");
  process.argv.push("server/index.ts");
} catch (error) {
  console.error("Error loading tsx:", error);
  console.log("Falling back to direct require...");
  
  try {
    // Try CommonJS require if available
    require("./server/index.ts");
  } catch (err) {
    console.error("Error loading server:", err);
    console.log("Attempting ESM import...");
    
    // Try to use import() if we're in an ESM context
    import("./server/index.ts").catch(e => {
      console.error("All loading methods failed:", e);
      process.exit(1);
    });
  }
}
