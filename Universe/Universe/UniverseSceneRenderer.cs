using System;

using Microsoft.Extensions.Logging;

using SceneKit;


namespace Universe
{
    public class UniverseSceneRenderer : SCNSceneRendererDelegate
    {
        private readonly ILogger logger;

        public UniverseSceneRenderer(ILogger logger)
        {
            this.logger = logger;
        }

        public override void WillRenderScene(ISCNSceneRenderer renderer, SCNScene scene, double timeInSeconds)
        {
            //this.logger.LogDebug("Will Render Scene...{TimeInSeconds}", timeInSeconds);

        }
    }
}
