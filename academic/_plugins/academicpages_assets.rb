require "fileutils"

Jekyll::Hooks.register :site, :post_write do |site|
  sources = %w[
    assets/js/plugins/jquery.greedy-navigation.js
    assets/js/_main.js
    assets/js/theme.js
  ]
  javascript = sources.map do |source|
    File.read(File.join(site.theme.root, source), encoding: "UTF-8")
  end.join("\n;\n")
  destination = File.join(site.dest, "assets/js/academicpages.js")
  FileUtils.mkdir_p(File.dirname(destination))
  File.write(destination, javascript)
end
