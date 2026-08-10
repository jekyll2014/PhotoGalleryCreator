using PhotoGalleryCreator.Models;

namespace PhotoGalleryCreator.Core;

/// <summary>
/// Enumerates a single folder into its direct image files and its subfolders, honouring
/// the <see cref="FolderEntry"/> flags. Recursion across the folder tree is driven by
/// <see cref="GalleryGenerator"/>, not here — this only inspects one level.
/// </summary>
public sealed class Scanner
{
    private static readonly string[] ReservedDirs = { ".web", ".description" };

    private readonly HashSet<string> _exts;

    public Scanner(IEnumerable<string> imageExtensions)
        => _exts = new HashSet<string>(imageExtensions.Select(e => e.ToLowerInvariant()),
                                       StringComparer.OrdinalIgnoreCase);

    public sealed record ScanResult(List<string> ImageFiles, List<string> Subfolders);

    /// <summary>
    /// Lists images directly in <paramref name="folderPath"/> (plus, when
    /// <paramref name="flattenSubfolderImages"/>, images from immediate subfolders), and the
    /// subfolders that should get their own linked gallery.
    /// </summary>
    public ScanResult Scan(string folderPath, FolderEntry entry)
    {
        var images = new List<string>(EnumerateImages(folderPath));

        var subfolders = new List<string>();
        if (entry.IncludeSubfolders)
        {
            foreach (var dir in System.IO.Directory.EnumerateDirectories(folderPath).OrderBy(d => d))
            {
                var name = Path.GetFileName(dir);
                if (IsReserved(name) || entry.IgnoreSubfolders.Contains(name, StringComparer.OrdinalIgnoreCase))
                    continue;

                subfolders.Add(dir);
                if (entry.FlattenSubfolderImages)
                    images.AddRange(EnumerateImages(dir));
            }
        }

        return new ScanResult(images, subfolders);
    }

    public IEnumerable<string> EnumerateImages(string folderPath)
        => System.IO.Directory.EnumerateFiles(folderPath)
            .Where(f => _exts.Contains(Path.GetExtension(f)))
            .OrderBy(f => f, StringComparer.OrdinalIgnoreCase);

    public bool IsImage(string path) => _exts.Contains(Path.GetExtension(path));

    private static bool IsReserved(string dirName)
        => ReservedDirs.Contains(dirName, StringComparer.OrdinalIgnoreCase)
           || dirName.StartsWith('.');
}
