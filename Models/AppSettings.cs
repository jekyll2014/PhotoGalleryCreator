using System.Text.Json;
using System.Text.Json.Serialization;

namespace PhotoGalleryCreator.Models;

/// <summary>
/// Top-level application settings, loaded from settings.json in the working directory
/// (or a path passed via --config). Also the shape of a per-folder .description json,
/// except there the <see cref="Folders"/> list is expected to be empty.
/// </summary>
public sealed class AppSettings
{
    /// <summary>Folders to turn into galleries. Empty in per-folder .description files.</summary>
    public List<FolderEntry> Folders { get; set; } = new();

    /// <summary>Template name under the app's /templates/ directory.</summary>
    public string Template { get; set; } = "template1";

    /// <summary>Long edge (px) of generated thumbnails.</summary>
    public int ThumbnailSize { get; set; } = 320;

    /// <summary>JPEG quality (1-100) for thumbnails.</summary>
    public int ThumbnailQuality { get; set; } = 80;

    /// <summary>How many thumbnails the front page loads up front; rest lazy-load.</summary>
    public int InitialThumbnails { get; set; } = 10;

    /// <summary>Neighbour images kept warm each side of the current one (2 =&gt; caches 5).</summary>
    public int CacheRadius { get; set; } = 2;

    /// <summary>Recognised image file extensions (lowercase, with dot).</summary>
    public List<string> ImageExtensions { get; set; } = new()
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff"
    };

    /// <summary>Optional gallery title / description shown at app-settings level (rarely used).</summary>
    public string? Title { get; set; }
    public string? Description { get; set; }

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() }
    };

    public static AppSettings Load(string path)
    {
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<AppSettings>(json, JsonOptions)
               ?? throw new InvalidOperationException($"Could not parse settings: {path}");
    }

    public void Save(string path)
        => File.WriteAllText(path, JsonSerializer.Serialize(this, JsonOptions));
}
