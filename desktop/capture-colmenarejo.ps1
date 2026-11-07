$ErrorActionPreference = 'Stop'
$culture = [Globalization.CultureInfo]::InvariantCulture
$relationId = 347003
$origin = 'https://api.openstreetmap.org/api/0.6'
$relationData = Invoke-RestMethod "$origin/relation/$relationId/full.json" -TimeoutSec 60
$nodes = @{}
$ways = @{}
function Add-Elements($elements) {
  foreach ($element in $elements) {
    if ($element.type -eq 'node') { $nodes[$element.id] = $element }
    if ($element.type -eq 'way') { $ways[$element.id] = $element }
  }
}
function Get-Geometry($way) {
  foreach ($id in $way.nodes) {
    $node = $nodes[$id]
    if ($null -eq $node) { throw "Missing OSM node $id" }
    @{ lat = $node.lat; lon = $node.lon }
  }
}
Add-Elements $relationData.elements
$relation = $relationData.elements | Where-Object { $_.type -eq 'relation' -and $_.id -eq $relationId }
if ($null -eq $relation) { throw 'Missing Colmenarejo relation' }
$members = @(foreach ($member in $relation.members) {
  if ($member.type -eq 'way' -and $member.role -in @('outer','inner')) {
    @{ type = 'way'; role = $member.role; ref = $member.ref; geometry = @(Get-Geometry $ways[$member.ref]) }
  }
})
$points = $members | ForEach-Object { $_.geometry }
$lon = $points | ForEach-Object { $_.lon } | Measure-Object -Minimum -Maximum
$lat = $points | ForEach-Object { $_.lat } | Measure-Object -Minimum -Maximum
$west = $lon.Minimum
$south = $lat.Minimum
$grid = 5
$dx = ($lon.Maximum - $west) / $grid
$dy = ($lat.Maximum - $south) / $grid
for ($x=0; $x -lt $grid; $x++) {
  for ($y=0; $y -lt $grid; $y++) {
    $bbox = (@(($west + $x*$dx), ($south + $y*$dy), ($west + ($x+1)*$dx), ($south + ($y+1)*$dy)) |
      ForEach-Object { $_.ToString('G17', $culture) }) -join ','
    $tile = Invoke-RestMethod "$origin/map.json?bbox=$bbox" -TimeoutSec 60
    Add-Elements $tile.elements
  }
}
$allowed = @('motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','pedestrian','service')
$streets = @(foreach ($way in ($ways.Values | Sort-Object id)) {
  if ($way.tags.name -and $way.tags.highway -in $allowed) {
    @{ type = 'way'; id = $way.id; tags = @{ name = $way.tags.name; highway = $way.tags.highway }; geometry = @(Get-Geometry $way) }
  }
})
if ($streets.Count -lt 20) { throw 'Unexpectedly few street ways' }
$context = @(foreach ($way in ($ways.Values | Sort-Object id)) {
  $tags = $way.tags
  if ($tags.building -or $tags.natural -in @('water','wood','scrub','grassland') -or
      $tags.landuse -in @('forest','grass','meadow','village_green') -or
      $tags.leisure -in @('park','garden','recreation_ground') -or $tags.waterway -eq 'riverbank') {
    if ($way.nodes.Count -ge 4 -and $way.nodes[0] -eq $way.nodes[-1]) {
      @{ type = 'way'; id = $way.id; tags = $tags; geometry = @(Get-Geometry $way) }
    }
  }
})
@{
  capturedAt = [DateTime]::UtcNow.ToString('o')
  boundary = @{ elements = @(@{ type = 'relation'; id = $relationId; members = $members; tags = $relation.tags }) }
  streets = @{ elements = $streets }
  context = @{ elements = $context }
} | ConvertTo-Json -Depth 12 -Compress | Set-Content -LiteralPath (Join-Path $PSScriptRoot '../public/colmenarejo-osm.json') -Encoding utf8NoBOM
Write-Output "Captured $($streets.Count) OSM ways"
