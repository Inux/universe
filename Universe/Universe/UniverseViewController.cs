using System;
using System.Collections.Generic;

using Microsoft.Extensions.Logging;

using AppKit;
using SceneKit;
using Universe.Elements;
using Foundation;

namespace Universe
{
    [Register("UniverseViewController")]
    public partial class UniverseViewController : NSViewController
    {
        private static ILoggerFactory loggerFactory = LoggerFactory.Create(
            builder =>
            {
                builder.AddConsole().SetMinimumLevel(LogLevel.Debug);
            });

        private ILogger logger = loggerFactory.CreateLogger<UniverseViewController>();

        public override void AwakeFromNib()
        {
            logger.LogDebug("Executing {Function} at Time {Time}", nameof(AwakeFromNib), DateTime.Now);

            // create a new scene
            //var scene = SCNScene.FromFile ("art.scnassets/ship");
            var scene = SCNScene.Create();

            scene.PhysicsWorld.Gravity = new SCNVector3(0, -1.81f, 0);

            // create and add a camera to the scene
            var cameraNode = SCNNode.Create();
            cameraNode.Camera = SCNCamera.Create();
            scene.RootNode.AddChildNode(cameraNode);

            // place the camera
            cameraNode.Position = new SCNVector3(0, 0, 15);

            // create and add a light to the scene
            var lightNode = SCNNode.Create();
            lightNode.Light = SCNLight.Create();
            lightNode.Light.LightType = SCNLightType.Omni;
            lightNode.Position = new SCNVector3(0, 10, 10);
            scene.RootNode.AddChildNode(lightNode);

            // create and add an ambient light to the scene
            var ambientLightNode = SCNNode.Create();
            ambientLightNode.Light = SCNLight.Create();
            ambientLightNode.Light.LightType = SCNLightType.Ambient;
            ambientLightNode.Light.Color = NSColor.DarkGray;
            scene.RootNode.AddChildNode(ambientLightNode);

            var floor = FloorFactory.Create();
            scene.RootNode.AddChildNode(floor);

            foreach (var node in SphereFactory.CreateGrid(new SCNVector3(0, 0, 0), 10, 10, 10, 1))
            {
                scene.RootNode.AddChildNode(node);
            }


            cameraNode.Look(new SCNVector3(0, 0, 0));

            // retrieve the ship node
            // var ship = scene.RootNode.FindChildNode ("ship", true);

            // animate the 3d object
            // var animation = CABasicAnimation.FromKeyPath ("rotation");
            // animation.To = NSValue.FromVector (new SCNVector4 (0, 1, 0, (nfloat) Math.PI * 2));
            // animation.Duration = 3;
            // animation.RepeatCount = float.MaxValue; //repeat forever
            // ship.AddAnimation (animation, null);

            // set the scene to the view
            MyUniverseView.Scene = scene;

            MyUniverseView.SceneRendererDelegate = new UniverseSceneRenderer(loggerFactory.CreateLogger<UniverseSceneRenderer>());

            // allows the user to manipulate the camera
            MyUniverseView.AllowsCameraControl = true;

            // show statistics such as fps and timing information
            MyUniverseView.ShowsStatistics = true;

            // configure the view
            MyUniverseView.BackgroundColor = NSColor.Black;

        }

        public override void UpdateViewConstraints()
        {
            logger.LogDebug("Executing {Function} at Time {Time}", nameof(UpdateViewConstraints), DateTime.Now);

            base.UpdateViewConstraints();
        }

        public override void ViewWillLayout()
        {
            logger.LogDebug("Executing {Function} at Time {Time}", nameof(ViewWillLayout), DateTime.Now);

            base.ViewWillLayout();
        }

        public override void ViewDidLayout()
        {
            logger.LogDebug("Executing {Function} at Time {Time}", nameof(ViewDidLayout), DateTime.Now);

            base.ViewDidLayout();
        }

        public override void KeyDown(NSEvent theEvent)
        {
            logger.LogDebug("Key Down: {KeyCode}", theEvent.KeyCode);
        }
    }
}
