require "cgi"

Jekyll::Hooks.register :pages, :post_render do |page|
  browser_title = page.data["browser_title"]
  next if browser_title.to_s.empty?

  escaped_title = CGI.escapeHTML(browser_title.to_s)
  page.output = page.output.sub(/<title>.*?<\/title>/m, "<title>#{escaped_title}</title>")
end
