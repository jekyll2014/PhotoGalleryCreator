using System.Text.Json;

namespace PhotoGalleryCreator.Models;

/// <summary>
/// Human-authored, per-folder metadata read from <c>&lt;folder&gt;/.web/description.json</c>.
/// Supplies the folder title/description and optional per-image titles/descriptions that
/// templates can surface as placeholders. Folder-level <em>settings</em> overrides live in a
/// sibling <c>.web/settings.json</c> (an <see cref="AppSettings"/> with an empty folders list).
/// These preference files live alongside the generated artifacts but are never overwritten by
/// generation (only index.html, web/ and thumbs/ are written).
/// </summary>
public sealed class FolderDescription
{
    /// <summary>Display title for the folder; falls back to the folder name when null.</summary>
    public string? Title { get; set; }

    /// <summary>Free-text description of the folder.</summary>
    public string? Description { get; set; }

    /// <summary>Per-image overrides keyed by file name (e.g. "IMG_001.jpg").</summary>
    public Dictionary<string, ImageDescription> Images { get; set; } = new();

    public static FolderDescription? TryLoad(string folderPath)
    {
        var path = System.IO.Path.Combine(folderPath, ".web", "description.json");
        if (!File.Exists(path)) return null;
        try
        {
            return JsonSerializer.Deserialize<FolderDescription>(
                File.ReadAllText(path), AppSettings.JsonOptions);
        }
        catch
        {
            return null; // malformed description shouldn't abort the whole build
        }
    }
}

/// <summary>Optional caption info for a single image file.</summary>
public sealed class ImageDescription
{
    public string? Title { get; set; }
    public string? Description { get; set; }
}
