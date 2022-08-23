using System;
using System.Collections.Generic;
using AppKit;
using SceneKit;
using Universe.Extensions;

namespace Universe.Elements
{
    public static class SphereFactory
    {
        public static SCNNode Create(SCNVector3 position, nfloat radius, NSColor color)
        {
            var material = SCNMaterial.Create();
            material.Diffuse.ContentColor = color;
            var sphere = SCNSphere.Create(radius);
            sphere.Materials = new SCNMaterial[] { material };
            var node = SCNNode.Create();
            node.Geometry = sphere;
            node.Position = position;
            node.PhysicsBody = SCNPhysicsBody.CreateDynamicBody();
            node.PhysicsBody.AffectedByGravity = true;

            return node;
        }

        public static IList<SCNNode> CreateGrid(SCNVector3 startPosition, nfloat width, nfloat height, nfloat depth, nfloat step)
        {
            var nodes = new List<SCNNode>();

            var xMax = startPosition.X + width;
            var yMax = startPosition.Y + height;
            var zMax = startPosition.Z + depth;

            for (var x = startPosition.X; x < xMax; x = x + step)
            {
                for (var y = startPosition.Y; y < yMax; y = y + step)
                {
                    for (var z = startPosition.Z; z < zMax; z = z + step)
                    {
                        var position = new SCNVector3(x, y, z);
                        position = position.AddNoise(0.5f);
                        nodes.Add(SphereFactory.Create(position, 0.1f, NSColor.Gray));
                    }
                }
            }

            return nodes;
        }
    }
}

