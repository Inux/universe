using System;
using SceneKit;

namespace Universe.Extensions
{
    public static class SCNVector3Extensions
    {
        private static readonly Random random = new Random();

        public static SCNVector3 AddNoise(this SCNVector3 vector, nfloat maxNoise)
        {
            double range = (double)maxNoise - ((double)-maxNoise);
            double minValue = -maxNoise;
            if(maxNoise < 0)
            {
                range = (double)-maxNoise - ((double)maxNoise);
                minValue = maxNoise;
            }

            var noise = random.NextDouble() * range + minValue;

            vector.X = vector.X + GetNoise(maxNoise);
            vector.Y = vector.Y + GetNoise(maxNoise);
            vector.Z = vector.Z + GetNoise(maxNoise);

            return vector;
        }

        private static nfloat GetNoise(nfloat maxNoise)
        {
            double range = (double)maxNoise - ((double)-maxNoise);
            double minValue = -maxNoise;
            if (maxNoise < 0)
            {
                range = (double)-maxNoise - ((double)maxNoise);
                minValue = maxNoise;
            }

            var noise = random.NextDouble() * range + minValue;

            return (nfloat)noise;
        }
    }
}
