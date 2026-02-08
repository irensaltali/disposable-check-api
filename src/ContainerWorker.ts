import { Container } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";

export class ReacherWorker extends Container<Env> {
    // Configure default port for the container
    defaultPort = 8080;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    override onStart(): void {
        console.log("ContainerWorker: Container started!");
    }

    override onStop(): void {
        console.log("ContainerWorker: Container stopped!");
    }

    override onError(error: unknown): void {
        console.error("ContainerWorker: Container error:", error);
    }
}

export { ReacherWorker as ContainerWorker };
