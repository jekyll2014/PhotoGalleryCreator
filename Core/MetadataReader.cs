using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using Directory = MetadataExtractor.Directory;

namespace PhotoGalleryCreator.Core;

/// <summary>Pulls a small set of display-friendly EXIF fields out of an image file.</summary>
public static class MetadataReader
{
    public readonly record struct ImageMeta(string? DateTaken, string? Camera);

    /// <summary>
    /// Best-effort EXIF read. Never throws; returns empty values when metadata is absent
    /// or the file is not a supported format.
    /// </summary>
    public static ImageMeta Read(string path)
    {
        try
        {
            IReadOnlyList<Directory> dirs = ImageMetadataReader.ReadMetadata(path);

            var subIfd = dirs.OfType<ExifSubIfdDirectory>().FirstOrDefault();
            var ifd0 = dirs.OfType<ExifIfd0Directory>().FirstOrDefault();

            string? date =
                subIfd?.GetDescription(ExifDirectoryBase.TagDateTimeOriginal)
                ?? ifd0?.GetDescription(ExifDirectoryBase.TagDateTime);

            string? make = ifd0?.GetDescription(ExifDirectoryBase.TagMake);
            string? model = ifd0?.GetDescription(ExifDirectoryBase.TagModel);
            string? camera = Join(make, model);

            return new ImageMeta(date, camera);
        }
        catch
        {
            return new ImageMeta(null, null);
        }
    }

    private static string? Join(string? make, string? model)
    {
        make = make?.Trim();
        model = model?.Trim();
        if (string.IsNullOrEmpty(make) && string.IsNullOrEmpty(model)) return null;
        if (string.IsNullOrEmpty(make)) return model;
        if (string.IsNullOrEmpty(model)) return make;
        // Avoid "Canon Canon EOS" style duplication.
        return model!.StartsWith(make!, StringComparison.OrdinalIgnoreCase) ? model : $"{make} {model}";
    }
}
