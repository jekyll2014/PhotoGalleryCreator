using PhotoGalleryCreator.Core;
using PhotoGalleryCreator.Models;

// pgc — Photo Gallery Creator. Static HTML gallery builder for disk folders.
//
// Usage:
//   pgc generate [--config <settings.json>]   Build galleries for the configured folders.
//   pgc init     [--config <settings.json>]   Write a sample settings.json to get started.
//   pgc help                                  Show this help.
//
// With no command, "generate" is assumed. Default config path is ./settings.json.

return Cli.Run(args);

static class Cli
{
    public static int Run(string[] args)
    {
        var (command, options) = Parse(args);
        var config = options.GetValueOrDefault("config", "settings.json");

        try
        {
            switch (command)
            {
                case "help" or "-h" or "--help":
                    PrintHelp();
                    return 0;

                case "init":
                    return Init(config);

                case "generate" or "":
                    return Generate(config);

                default:
                    Console.Error.WriteLine($"Unknown command: {command}");
                    PrintHelp();
                    return 2;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"error: {ex.Message}");
            return 1;
        }
    }

    static int Generate(string config)
    {
        if (!File.Exists(config))
        {
            Console.Error.WriteLine($"No config at '{config}'. Run 'pgc init' to create one.");
            return 1;
        }

        var settings = AppSettings.Load(config);
        if (settings.Folders.Count == 0)
        {
            Console.Error.WriteLine("Config has no folders. Add entries to the 'folders' array.");
            return 1;
        }

        var templatesRoot = TemplatesRoot();
        if (!Directory.Exists(Path.Combine(templatesRoot, settings.Template)))
        {
            Console.Error.WriteLine($"Template '{settings.Template}' not found under {templatesRoot}");
            return 1;
        }

        Console.WriteLine($"Templates: {templatesRoot}");
        new GalleryGenerator(settings, templatesRoot).Run();
        Console.WriteLine("Done.");
        return 0;
    }

    static int Init(string config)
    {
        if (File.Exists(config))
        {
            Console.Error.WriteLine($"'{config}' already exists; not overwriting.");
            return 1;
        }

        var sample = new AppSettings
        {
            Template = "template1",
            Folders =
            {
                new FolderEntry
                {
                    Path = @"C:\Photos\Sample",
                    IncludeSubfolders = true,
                    FlattenSubfolderImages = false,
                    Ignore = false
                }
            }
        };
        sample.Save(config);
        Console.WriteLine($"Wrote {config}. Edit the 'folders' list, then run: pgc generate");
        return 0;
    }

    static string TemplatesRoot() => Path.Combine(AppContext.BaseDirectory, "templates");

    static (string command, Dictionary<string, string> options) Parse(string[] args)
    {
        string command = "";
        var options = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        int i = 0;
        if (args.Length > 0 && !args[0].StartsWith('-'))
        {
            command = args[0].ToLowerInvariant();
            i = 1;
        }

        for (; i < args.Length; i++)
        {
            var a = args[i];
            if (a is "--config" or "-c")
            {
                if (i + 1 < args.Length) options["config"] = args[++i];
            }
            else if (a.StartsWith("--") && a.Contains('='))
            {
                var kv = a[2..].Split('=', 2);
                options[kv[0]] = kv[1];
            }
        }

        return (command, options);
    }

    static void PrintHelp() => Console.WriteLine(
        """
        pgc — Photo Gallery Creator (static HTML galleries for disk folders)

          pgc generate [--config <settings.json>]   Build galleries (default command)
          pgc init     [--config <settings.json>]   Write a starter settings.json
          pgc help                                  This help

        Output for each folder lands in <folder>/.web/ (index.html, web/, thumbs/).
        """);
}
