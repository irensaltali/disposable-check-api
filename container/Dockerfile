FROM reacherhq/backend:latest

# The default port for reacherhq/backend is 8080.
# Cloudflare Containers automatically handle the PORT env var if configured, 
# but reacherhq might expect RCH__HTTP_PORT or similar if we want to change it.
# However, usually we can just let it run on 8080 and map it in the worker if needed.

# We just need to expose the port.
EXPOSE 8080
