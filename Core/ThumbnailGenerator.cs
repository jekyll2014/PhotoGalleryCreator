using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;

namespace PhotoGalleryCreator.Core;

/// <summary>
/// Produces baked JPEG thumbnails. All resizing happens at generation time so the
/// published gallery is 100% static — the browser never processes full images.
/// </summary>
public sealed class ThumbnailGenerator
{
    private readonly int _longEdge;
    private readonly int _quality;

    public ThumbnailGenerator(int longEdge, int quality)
    {
        _longEdge = Math.Max(16, longEdge);
        _quality = Math.Clamp(quality, 1, 100);
    }

    /// <summary>
    /// Writes a downscaled JPEG of <paramref name="sourcePath"/> to <paramref name="thumbPath"/>.
    /// Skips work when an up-to-date thumbnail already exists (source not newer). Returns the
    /// source image's pixel dimensions regardless.
    /// </summary>
    public (int Width, int Height) Generate(string sourcePath, string thumbPath)
    {
        System.IO.Directory.CreateDirectory(Path.GetDirectoryName(thumbPath)!);

        // Read dimensions cheaply without decoding pixels.
        var info = Image.Identify(sourcePath);
        int width = info.Width, height = info.Height;

        if (IsUpToDate(sourcePath, thumbPath))
            return (width, height);

        using var image = Image.Load(sourcePath);
        image.Mutate(x => x.AutoOrient().Resize(new ResizeOptions
        {
            Size = new Size(_longEdge, _longEdge),
            Mode = ResizeMode.Max // preserve aspect ratio, fit within longEdge box
        }));

        image.Save(thumbPath, new JpegEncoder { Quality = _quality });
        return (width, height);
    }

    private static bool IsUpToDate(string source, string thumb)
        => File.Exists(thumb) &&
           File.GetLastWriteTimeUtc(thumb) >= File.GetLastWriteTimeUtc(source);
}
