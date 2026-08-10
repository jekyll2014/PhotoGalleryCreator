using System.Text;
using PhotoGalleryCreator.Models;
using Scriban;
using Scriban.Runtime;

namespace PhotoGalleryCreator.Core;

/// <summary>
/// Walks the configured folder tree and, for each folder, emits a fully static gallery under
/// <c>&lt;folder&gt;/.web/</c>: index.html (rendered from the chosen template), the template's
/// web/ resources, and baked thumbnails. Subfolders are generated first so their preview
/// thumbnails are available to the parent, and are linked from the parent as folder tiles.
/// </summary>
public sealed class GalleryGenerator
{
    private readonly AppSettings _appSettings;
    private readonly string _templatesRoot;
    private readonly string _generatedAt;

    public GalleryGenerator(AppSettings appSettings, string templatesRoot)
    {
        _appSettings = appSettings;
        _templatesRoot = templatesRoot;
        _generatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
    }

    private static readonly System.Text.Json.JsonSerializerOptions JsIslandOptions = new()
    {
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
    };

    public void Run()
    {
        foreach (var entry in _appSettings.Folders)
        {
            if (entry.Ignore) { Console.WriteLine($"skip (ignored): {entry.Path}"); continue; }

            var full = Path.GetFullPath(entry.Path);
            if (!System.IO.Directory.Exists(full))
            {
                Console.WriteLine($"skip (missing): {full}");
                continue;
            }
            GenerateFolder(full, entry, _appSettings);
        }
    }

    /// <summary>Generates one folder gallery (recursing into subfolders first). Returns the
    /// path of the first thumbnail produced, for use as the parent's preview tile.</summary>
    private string? GenerateFolder(string folderPath, FolderEntry entry, AppSettings inherited)
    {
        // Effective settings = inherited, overlaid by this folder's .description/settings.json.
        var settings = OverlaySettings(inherited, folderPath);

        var scanner = new Scanner(settings.ImageExtensions);
        var scan = scanner.Scan(folderPath, entry);
        var desc = FolderDescription.TryLoad(folderPath);

        var webDir = Path.Combine(folderPath, ".web");
        var thumbsDir = Path.Combine(webDir, "thumbs");
        System.IO.Directory.CreateDirectory(thumbsDir);

        var thumbGen = new ThumbnailGenerator(settings.ThumbnailSize, settings.ThumbnailQuality);

        // Recurse into subfolders (each its own gallery); collect preview thumbs for tiles.
        var subTiles = new List<GallerySubfolder>();
        foreach (var sub in scan.Subfolders)
        {
            var subEntry = new FolderEntry
            {
                Path = sub,
                IncludeSubfolders = entry.IncludeSubfolders,
                FlattenSubfolderImages = entry.FlattenSubfolderImages,
                IgnoreSubfolders = entry.IgnoreSubfolders
            };
            var subPreview = GenerateFolder(sub, subEntry, settings);
            var subDesc = FolderDescription.TryLoad(sub);
            var subName = Path.GetFileName(sub);

            subTiles.Add(new GallerySubfolder
            {
                Name = subName,
                Title = subDesc?.Title ?? subName,
                // From this folder's .web/index.html to the subfolder's gallery.
                Link = $"../{RelUrl(Path.GetRelativePath(folderPath, sub))}/.web/index.html",
                Thumb = subPreview is null
                    ? null
                    : $"../{RelUrl(Path.GetRelativePath(folderPath, subPreview))}"
            });
        }

        // Build image tiles (thumbnail + metadata + captions).
        var imageTiles = new List<GalleryImage>();
        string? firstThumbAbs = null;
        foreach (var imgPath in scan.ImageFiles)
        {
            var fileName = Path.GetFileName(imgPath);
            var thumbName = ThumbName(folderPath, imgPath);
            var thumbAbs = Path.Combine(thumbsDir, thumbName);

            (int w, int h) = thumbGen.Generate(imgPath, thumbAbs);
            var meta = MetadataReader.Read(imgPath);
            ImageDescription? cap = null;
            desc?.Images.TryGetValue(fileName, out cap);

            imageTiles.Add(new GalleryImage
            {
                FileName = fileName,
                Title = cap?.Title ?? Path.GetFileNameWithoutExtension(fileName),
                Description = cap?.Description,
                Thumb = $"thumbs/{RelUrl(thumbName)}",
                Full = $"../{RelUrl(Path.GetRelativePath(folderPath, imgPath))}",
                Width = w,
                Height = h,
                DateTaken = meta.DateTaken,
                Camera = meta.Camera
            });

            firstThumbAbs ??= thumbAbs;
        }

        var folderName = Path.GetFileName(folderPath.TrimEnd(Path.DirectorySeparatorChar));
        var model = new GalleryModel
        {
            Folder = new GalleryFolder
            {
                Name = folderName,
                Title = desc?.Title ?? settings.Title ?? folderName,
                Description = desc?.Description ?? settings.Description
            },
            Images = imageTiles,
            Subfolders = subTiles,
            Settings = new GallerySettings
            {
                InitialThumbnails = settings.InitialThumbnails,
                CacheRadius = settings.CacheRadius
            },
            GeneratedAt = _generatedAt
        };

        RenderTemplate(settings.Template, model, webDir);

        Console.WriteLine($"built: {folderPath}  ({imageTiles.Count} images, {subTiles.Count} subfolders)");
        return firstThumbAbs;
    }

    private AppSettings OverlaySettings(AppSettings inherited, string folderPath)
    {
        var overridePath = Path.Combine(folderPath, ".web", "settings.json");
        if (!File.Exists(overridePath)) return inherited;
        try
        {
            var o = AppSettings.Load(overridePath);
            // Inherit template/extensions unless the override clearly sets them; copy scalar knobs.
            return new AppSettings
            {
                Folders = new(),
                Template = o.Template,
                ThumbnailSize = o.ThumbnailSize,
                ThumbnailQuality = o.ThumbnailQuality,
                InitialThumbnails = o.InitialThumbnails,
                CacheRadius = o.CacheRadius,
                ImageExtensions = o.ImageExtensions.Count > 0 ? o.ImageExtensions : inherited.ImageExtensions,
                Title = o.Title ?? inherited.Title,
                Description = o.Description ?? inherited.Description
            };
        }
        catch
        {
            return inherited;
        }
    }

    private void RenderTemplate(string templateName, GalleryModel model, string webDir)
    {
        var templateDir = Path.Combine(_templatesRoot, templateName);
        var indexTemplate = Path.Combine(templateDir, "index.sbn");
        if (!File.Exists(indexTemplate))
            throw new FileNotFoundException($"Template not found: {indexTemplate}");

        var template = Template.Parse(File.ReadAllText(indexTemplate), indexTemplate);
        if (template.HasErrors)
            throw new InvalidOperationException(
                $"Template errors in {indexTemplate}:\n{string.Join("\n", template.Messages)}");

        var ctx = new TemplateContext { MemberRenamer = m => m.Name.ToSnakeCase() };
        var script = new ScriptObject();
        script.Import(model, renamer: m => m.Name.ToSnakeCase());
        // Ready-to-embed JSON island for the client script (lazy-load + neighbour caching).
        // System.Text.Json's default encoder escapes <, > and & so it is safe inside <script>.
        script.Add("data_json", System.Text.Json.JsonSerializer.Serialize(model, JsIslandOptions));
        ctx.PushGlobal(script);

        var html = template.Render(ctx);
        System.IO.Directory.CreateDirectory(webDir);
        File.WriteAllText(Path.Combine(webDir, "index.html"), html, new UTF8Encoding(false));

        // Copy the template's static web/ resources (css/js) into the output.
        var srcWeb = Path.Combine(templateDir, "web");
        if (System.IO.Directory.Exists(srcWeb))
            CopyDir(srcWeb, Path.Combine(webDir, "web"));
    }

    private static void CopyDir(string src, string dst)
    {
        System.IO.Directory.CreateDirectory(dst);
        foreach (var file in System.IO.Directory.EnumerateFiles(src))
            File.Copy(file, Path.Combine(dst, Path.GetFileName(file)), overwrite: true);
        foreach (var dir in System.IO.Directory.EnumerateDirectories(src))
            CopyDir(dir, Path.Combine(dst, Path.GetFileName(dir)));
    }

    /// <summary>Thumb file name unique within a folder even when subfolder images are flattened in.</summary>
    private static string ThumbName(string folderPath, string imagePath)
    {
        var rel = Path.GetRelativePath(folderPath, imagePath);
        var safe = rel.Replace(Path.DirectorySeparatorChar, '_').Replace(Path.AltDirectorySeparatorChar, '_');
        return Path.ChangeExtension(safe, ".jpg");
    }

    private static string RelUrl(string path) => path.Replace('\\', '/');
}

file static class SnakeCaseExtensions
{
    /// <summary>PascalCase -&gt; snake_case (matches Scriban's default member renamer).</summary>
    public static string ToSnakeCase(this string name)
    {
        var sb = new StringBuilder(name.Length + 4);
        for (int i = 0; i < name.Length; i++)
        {
            char c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0) sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else sb.Append(c);
        }
        return sb.ToString();
    }
}
