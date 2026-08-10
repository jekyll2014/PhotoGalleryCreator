namespace PhotoGalleryCreator.Models;

/// <summary>
/// One folder in the app settings <c>folders</c> list, with flags controlling how
/// subfolders are handled during scanning.
/// </summary>
public sealed class FolderEntry
{
    /// <summary>Absolute or relative path to the folder to build a gallery for.</summary>
    public string Path { get; set; } = "";

    /// <summary>Skip this entry entirely when set.</summary>
    public bool Ignore { get; set; }

    /// <summary>Recurse into subfolders (each becomes its own linked gallery).</summary>
    public bool IncludeSubfolders { get; set; } = true;

    /// <summary>
    /// Pull images found in subfolders up into this folder's root image list
    /// (in addition to / instead of showing the subfolder as a folder icon).
    /// </summary>
    public bool FlattenSubfolderImages { get; set; }

    /// <summary>Subfolder names to exclude from scanning.</summary>
    public List<string> IgnoreSubfolders { get; set; } = new();
}
