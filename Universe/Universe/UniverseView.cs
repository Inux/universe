using System;

using AppKit;
using SceneKit;
using Foundation;

namespace Universe
{
    [Register("UniverseView")]
    public partial class UniverseView : SCNView
    {
        public UniverseView(IntPtr Handle) : base(Handle) { }

        // forward click event to the universe view controller
        public override void MouseDown(NSEvent theEvent)
        {
            // Called when a mouse click occurs

            // check what nodes are clicked
            var p = ConvertPointFromView(theEvent.LocationInWindow, null);
            var hitResults = HitTest(p, (NSDictionary)null);

            // check that we clicked on at least one object
            if (hitResults.Length > 0)
            {
                // retrieved the first clicked object
                var result = hitResults[0];

                // get its material
                var material = result.Node.Geometry.FirstMaterial;

                // highlight it
                SCNTransaction.Begin();
                SCNTransaction.AnimationDuration = 0.5f;

                // on completion - unhighlight
                SCNTransaction.SetCompletionBlock(() =>
                {
                    SCNTransaction.Begin();
                    SCNTransaction.AnimationDuration = 0.5f;

                    material.Emission.Contents = NSColor.Black;

                    SCNTransaction.Commit();
                });

                material.Emission.Contents = NSColor.Red;

                SCNTransaction.Commit();
            }

            base.MouseDown(theEvent);
        }

        public override void KeyDown(NSEvent theEvent)
        {
            Console.WriteLine("Key Down: {0}", theEvent.KeyCode);

            base.KeyDown(theEvent);
        }
    }
}

