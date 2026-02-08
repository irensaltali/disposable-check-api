import http.server
import socketserver
import os
import signal
import sys

PORT = int(os.environ.get("PORT", 8080))

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"message": "Hello from Python Container running on Cloudflare!"}')

def run():
    print(f"Starting server on port {PORT}")
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        def signal_handler(sig, frame):
            print('Shutting down server...')
            httpd.shutdown()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        httpd.serve_forever()

if __name__ == "__main__":
    run()
