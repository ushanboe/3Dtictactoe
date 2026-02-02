export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md text-center border border-white/10">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Authentication Error</h1>
        <p className="text-gray-300 mb-6">
          There was a problem signing you in. This could be due to:
        </p>
        <ul className="text-left text-gray-400 mb-6 space-y-2">
          <li>• An expired or invalid authentication link</li>
          <li>• Browser cookies being blocked</li>
          <li>• A temporary server issue</li>
        </ul>
        <a 
          href="/" 
          className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Back to Game
        </a>
      </div>
    </div>
  )
}
