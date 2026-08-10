namespace PhotoGalleryCreator.Models;

/// <summary>
/// The fully-resolved view model handed to the template engine to render one folder's
/// index.html. Property names double as template placeholders (Scriban lowercases them,
/// e.g. <c>{{ folder.title }}</c>, <c>{{ for img in images }}</c>).
/// </summary>
public sealed class GalleryModel
{
    public required GalleryFolder Folder { get; init; }
    public required List<GalleryImage> Images { get; init; }
    public required List<GallerySubfolder> Subfolders { get; init; }
    public required GallerySettings Settings { get; init; }
    public string GeneratedAt { get; init; } = "";
}

public sealed class GalleryFolder
{
    public required string Name { get; init; }
    public required string Title { get; init; }
    public string? Description { get; init; }
}

public sealed class GallerySettings
{
    public int InitialThumbnails { get; init; }
    public int CacheRadius { get; init; }
}

/// <summary>One image tile. Paths are relative to the folder's <c>.web/</c> output dir.</summary>
public sealed class GalleryImage
{
    public required string FileName { get; init; }
    public required string Title { get; init; }
    public string? Description { get; init; }

    /// <summary>Thumbnail path, e.g. <c>thumbs/IMG_001.jpg</c>.</summary>
    public required string Thumb { get; init; }

    /// <summary>Full-size image path relative to <c>.web/</c>, e.g. <c>../IMG_001.jpg</c>.</summary>
    public required string Full { get; init; }

    public int Width { get; init; }
    public int Height { get; init; }
    public string? DateTaken { get; init; }
    public string? Camera { get; init; }
}

/// <summary>A subfolder tile rendered as a folder icon in the image strip.</summary>
public sealed class GallerySubfolder
{
    public required string Name { get; init; }
    public required string Title { get; init; }

    /// <summary>Relative link to the subfolder's generated gallery, e.g. <c>../Sub/.web/index.html</c>.</summary>
    public required string Link { get; init; }

    /// <summary>Optional preview thumbnail (first image in the subfolder), if available.</summary>
    public string? Thumb { get; init; }
}
