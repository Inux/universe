using System;
using System.Drawing;
using AppKit;
using SceneKit;

namespace Universe.Elements
{
    public static class FloorFactory
    {
        public static SCNNode Create()
        {
            var material = SCNMaterial.Create();
            material.Diffuse.ContentColor = NSColor.Black;
            var floor = SCNFloor.Create();
            floor.Materials = new SCNMaterial[] { material };
            var node = SCNNode.Create();
            node.Geometry = floor;
            node.Position = new SCNVector3(0, 0, 0);
            node.PhysicsBody = SCNPhysicsBody.CreateStaticBody();

            return node;
        }
    }
}

