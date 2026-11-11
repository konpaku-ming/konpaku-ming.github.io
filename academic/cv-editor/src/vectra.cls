%%
%% Vectra: Versatile Experience and Career Template for Research and Academia
%% Copyright (c) 2026 Yixuan Huang
%%
%% This file is part of Vectra.
%% Distributed under the LaTeX Project Public License, version 1.3c or later.
%% This work has the LPPL maintenance status "maintained".
%% The Current Maintainer of this work is Yixuan Huang.
%%
%% Official repository:
%% https://github.com/yixnhuang/vectra
%%

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{vectra}[2026/09/14 v1.2.0 Vectra CV and resume template]

% ---------------------------------------------------------------------------
% Class options
% ---------------------------------------------------------------------------
%
%   academic   the default. An academic CV: 11pt, moderate margins, generous
%              entry spacing, a display-size name. Unchanged from v0.2.0, and
%              a document that passes no option gets byte-identical output.
%
%   compact    a one-page professional resume: 10pt, tighter margins, smaller
%              section titles, less air between entries. The difference is
%              entirely in the design parameters -- vectra-compact.sty
%              redefines what vectra-design.sty set and touches no macro --
%              so the two styles differ in measurement, never in behavior.
%
% Any other option is passed to article, so [twoside] and friends still work.

\newif\ifVectra@compact
\Vectra@compactfalse

\DeclareOption{academic}{\Vectra@compactfalse}
\DeclareOption{compact}{\Vectra@compacttrue}
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{article}}
\ProcessOptions\relax

\ifVectra@compact
    \LoadClass[10pt,letterpaper]{article}
\else
    \LoadClass[10pt,letterpaper]{article}
\fi

% vectra-compact must sit between design, which it overrides, and core, which
% reads the margin lengths and hands them to geometry.
\RequirePackage{vectra-design}
\ifVectra@compact
    \RequirePackage{vectra-compact}
\fi
\RequirePackage{vectra-fonts}
\RequirePackage{vectra-colors}
\RequirePackage{vectra-core}
\RequirePackage{vectra-accessibility}
\RequirePackage{vectra-layout}
\RequirePackage{vectra-header}
\RequirePackage{vectra-footer}
\RequirePackage{vectra-sections}

\endinput
